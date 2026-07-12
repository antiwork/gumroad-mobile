import { buildApiUrl, requestAPI } from "@/lib/request";
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
  type: "api_write" | "create_discount" | "update_product_price" | "publish_product" | "unpublish_product";
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

type SendMessageResponse =
  | { success: true; reply: string; proposed_action: ProposedAction | null; conversation_id?: string }
  | { success: false; error: string };

interface ExecuteActionResponse {
  success: boolean;
  message: string;
}

export const fetchAgentMeta = (accessToken: string) =>
  requestAPI<AgentMetaResponse>("mobile/agent/meta", { method: "GET", accessToken });

export const sendAgentMessage = async ({
  messages,
  conversationId,
  accessToken,
}: {
  messages: ChatMessage[];
  conversationId?: string | null;
  accessToken: string;
}): Promise<{ reply: string; proposedAction: ProposedAction | null; conversationId: string | null }> => {
  const json = await requestAPI<SendMessageResponse>("mobile/agent/messages", {
    method: "POST",
    data: { messages, ...(conversationId ? { conversation_id: conversationId } : {}) },
    accessToken,
  });
  if (!json.success) throw new Error(json.error);
  return { reply: json.reply, proposedAction: json.proposed_action, conversationId: json.conversation_id ?? null };
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
  const response = await streamingFetch(buildApiUrl("mobile/agent/messages/stream"), {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messages, ...(conversationId ? { conversation_id: conversationId } : {}) }),
  });

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
      buffer += decoder.decode(value, { stream: true });
      let separator = buffer.indexOf("\n\n");
      while (separator !== -1) {
        const frame = buffer.slice(0, separator);
        buffer = buffer.slice(separator + 2);
        if (frame.trim().length > 0) done = handleFrame(frame) ?? done;
        separator = buffer.indexOf("\n\n");
      }
    }
    if (buffer.trim().length > 0) {
      try {
        done = handleFrame(buffer) ?? done;
      } catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
      }
    }
  } finally {
    reader.cancel().catch(() => {});
  }

  if (!done) throw new Error("Agent stream ended without a done event");
  return done;
};
