import { buildApiUrl, REQUEST_TIMEOUT_MS, requestAPI, UnauthorizedError } from "@/lib/request";
import { fetch as streamingFetch } from "expo/fetch";

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ProposedActionField {
  label: string;
  value: string;
}

export interface ProposedAction {
  type: "api_write";
  params: Record<string, unknown>;
  summary: string;
  title?: string;
  fields?: ProposedActionField[];
}

interface AgentMetaResponse {
  success: boolean;
  enabled: boolean;
  greeting: string;
  suggestions: string[];
}

interface ExecuteActionResponse {
  success: boolean;
  message: string;
}

export const fetchAgentMeta = (accessToken: string) =>
  requestAPI<AgentMetaResponse>("mobile/agent/meta", { method: "GET", accessToken });

export interface ConversationMessage {
  role: ChatRole;
  content: string;
  proposed_action?: ProposedAction | null;
  action_status?: "applied" | "dismissed" | null;
}

export interface AgentConversation {
  id: string;
  title: string | null;
  messages: ConversationMessage[];
}

type LatestConversationResponse = { success: true; conversation: AgentConversation | null };

export const fetchLatestAgentConversation = async (accessToken: string): Promise<AgentConversation | null> => {
  const json = await requestAPI<LatestConversationResponse>("mobile/agent/conversations/latest", {
    method: "GET",
    accessToken,
  });
  return json.conversation;
};

export const executeAgentAction = async ({
  action,
  conversationId,
  accessToken,
}: {
  action: ProposedAction;
  conversationId?: string | null;
  accessToken: string;
}): Promise<string> => {
  const json = await requestAPI<ExecuteActionResponse>("mobile/agent/actions", {
    method: "POST",
    data: {
      type: action.type,
      params: action.params,
      ...(conversationId ? { conversation_id: conversationId } : {}),
    },
    accessToken,
  });
  if (!json.success) throw new Error(json.message);
  return json.message;
};

export interface AgentStreamHandlers {
  onToken?: (text: string) => void;
  onReset?: () => void;
}

export interface AgentStreamResult {
  reply: string;
  proposedAction: ProposedAction | null;
  conversationId: string | null;
}

interface DoneEventData {
  reply: string;
  proposed_action: ProposedAction | null;
  conversation_id?: string;
}

export const streamAgentMessage = async ({
  messages,
  conversationId,
  accessToken,
  handlers = {},
}: {
  messages: ChatMessage[];
  conversationId?: string | null;
  accessToken: string;
  handlers?: AgentStreamHandlers;
}): Promise<AgentStreamResult> => {
  // Abort the request if the server goes quiet for too long. The timer restarts on every
  // received chunk, so a long reply streams fine — only a stalled connection gets cut off.
  const controller = new AbortController();
  let timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const resetIdleTimeout = () => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  };

  try {
    const response = await streamingFetch(buildApiUrl("mobile/agent/messages/stream"), {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messages, ...(conversationId ? { conversation_id: conversationId } : {}) }),
      signal: controller.signal,
    });

    if (response.status === 401) throw new UnauthorizedError("Unauthorized");
    const body = response.body;
    if (!response.ok || !response.headers.get("content-type")?.includes("text/event-stream") || !body) {
      throw new Error(`Agent stream request failed: ${response.status}`);
    }

    let done: AgentStreamResult | null = null;

    const handleFrame = (frame: string): AgentStreamResult | null => {
      let event = "message";
      const dataLines: string[] = [];
      for (const line of frame.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
      }
      if (dataLines.length === 0) return null;
      const raw: unknown = JSON.parse(dataLines.join("\n"));

      switch (event) {
        case "token": {
          const { text } = raw as { text: string };
          handlers.onToken?.(text);
          return null;
        }
        case "reset": {
          handlers.onReset?.();
          return null;
        }
        case "done": {
          const data = raw as DoneEventData;
          return {
            reply: data.reply,
            proposedAction: data.proposed_action,
            conversationId: data.conversation_id ?? conversationId ?? null,
          };
        }
        case "error": {
          throw new Error((raw as { message: string }).message);
        }
        default:
          return null;
      }
    };

    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      for (;;) {
        const { value, done: streamDone } = await reader.read();
        if (streamDone) break;
        resetIdleTimeout();
        buffer += decoder.decode(value, { stream: true });
        let separator = buffer.indexOf("\n\n");
        while (separator !== -1) {
          const frame = buffer.slice(0, separator);
          buffer = buffer.slice(separator + 2);
          if (frame.trim().length > 0) done = handleFrame(frame) ?? done;
          separator = buffer.indexOf("\n\n");
        }
      }
    } finally {
      reader.cancel().catch(() => {});
    }
    if (buffer.trim().length > 0) {
      try {
        done = handleFrame(buffer) ?? done;
      } catch (error) {
        // Data left in the buffer after the stream closes means the last frame was cut off
        // mid-transmission, so failing to parse it as JSON is expected — we fall through to
        // the "ended without a done event" error below. Anything else is a real error.
        if (!(error instanceof SyntaxError)) throw error;
      }
    }

    if (!done) throw new Error("Agent stream ended without a done event");
    return done;
  } finally {
    clearTimeout(timeoutId);
  }
};
