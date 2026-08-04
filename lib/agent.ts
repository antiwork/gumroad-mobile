import { buildApiUrl, REQUEST_TIMEOUT_MS, requestAPI, RequestError, UnauthorizedError } from "@/lib/request";
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
  proposal_message_id?: string | null;
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
  proposalMessageId,
  accessToken,
}: {
  action: ProposedAction;
  conversationId?: string | null;
  proposalMessageId?: string | null;
  accessToken: string;
}): Promise<string> => {
  const json = await requestAPI<ExecuteActionResponse>("mobile/agent/actions", {
    method: "POST",
    data: {
      type: action.type,
      params: action.params,
      ...(conversationId ? { conversation_id: conversationId } : {}),
      ...(proposalMessageId ? { proposal_message_id: proposalMessageId } : {}),
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
  proposalMessageId: string | null;
  conversationId: string | null;
}

interface DoneEventData {
  reply: string;
  proposed_action: ProposedAction | null;
  proposal_message_id?: string | null;
  conversation_id?: string;
}

// Thrown when the stream ends without a `done` event: the connection broke, but the server may
// still be generating the turn and may yet persist it. The caller recovers by asking the
// turn-status endpoint what became of this exact turn, rather than assuming the turn was lost.
export type AgentStreamInterruptionPhase = "request" | "stream";

export class AgentStreamInterruptedError extends Error {
  readonly cause?: unknown;
  readonly phase: AgentStreamInterruptionPhase;

  constructor({ cause, phase = "stream" }: { cause?: unknown; phase?: AgentStreamInterruptionPhase } = {}) {
    super("Agent stream interrupted");
    this.name = "AgentStreamInterruptedError";
    this.cause = cause;
    this.phase = phase;
  }
}

export type AgentTurnStatus =
  | { status: "persisted"; conversationId: string; message: ConversationMessage }
  | { status: "in_progress" | "failed" | "unknown" };

export class AgentTurnStatusError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentTurnStatusError";
  }
}

const TURN_RECOVERY_POLL_INTERVAL_MS = 3000;
const TURN_RECOVERY_DEADLINE_MS = 180_000;
const TURN_RECOVERY_MAX_CONSECUTIVE_UNKNOWNS = 2;
const INITIAL_REQUEST_MAX_CONSECUTIVE_FAILURES = 2;

const recoveryAbortedError = () => {
  const error = new Error("Agent turn recovery cancelled");
  error.name = "AbortError";
  return error;
};

const throwIfAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) throw recoveryAbortedError();
};

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    throwIfAborted(signal);
    const timeoutId = setTimeout(() => {
      signal?.removeEventListener("abort", handleAbort);
      resolve();
    }, ms);
    const handleAbort = () => {
      clearTimeout(timeoutId);
      reject(recoveryAbortedError());
    };
    signal?.addEventListener("abort", handleAbort, { once: true });
  });

const runBeforeDeadline = async <T>(
  deadline: number,
  run: (signal: AbortSignal) => Promise<T>,
  externalSignal?: AbortSignal,
): Promise<T> => {
  throwIfAborted(externalSignal);
  const remainingTime = deadline - Date.now();
  if (remainingTime <= 0) throw new Error("Agent turn recovery timed out");

  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(new Error("Agent turn recovery timed out"));
    }, remainingTime);
  });
  let handleExternalAbort: (() => void) | undefined;
  const externalAbort = new Promise<never>((_, reject) => {
    if (!externalSignal) return;
    handleExternalAbort = () => {
      controller.abort();
      reject(recoveryAbortedError());
    };
    externalSignal.addEventListener("abort", handleExternalAbort, { once: true });
  });

  try {
    const attempt = run(controller.signal);
    // Promise.race observes losing rejections, but keep an explicit handler on the aborted request
    // as well so React Native error tooling never treats its late AbortError as unhandled.
    void attempt.catch(() => {});
    return await Promise.race([attempt, timeout, externalAbort]);
  } finally {
    clearTimeout(timeoutId);
    if (handleExternalAbort) externalSignal?.removeEventListener("abort", handleExternalAbort);
  }
};

type AgentTurnStatusResponse =
  | { success: true; status: "persisted"; conversation_id: string; message: ConversationMessage }
  | { success: true; status: "in_progress" | "failed" | "unknown" }
  | { success: false; error: string };

export const fetchAgentTurnStatus = async (
  clientTurnId: string,
  accessToken: string,
  signal?: AbortSignal,
): Promise<AgentTurnStatus> => {
  const json = await requestAPI<AgentTurnStatusResponse>(`mobile/agent/turns/${encodeURIComponent(clientTurnId)}`, {
    method: "GET",
    accessToken,
    signal,
  });
  if (!json.success) throw new AgentTurnStatusError(json.error);
  return json.status === "persisted"
    ? { status: json.status, conversationId: json.conversation_id, message: json.message }
    : { status: json.status };
};

export const recoverAgentTurn = async (
  clientTurnId: string,
  fetchStatus: (clientTurnId: string, signal: AbortSignal) => Promise<AgentTurnStatus>,
  {
    pollIntervalMs = TURN_RECOVERY_POLL_INTERVAL_MS,
    interruptionPhase = "stream",
    signal,
  }: { pollIntervalMs?: number; interruptionPhase?: AgentStreamInterruptionPhase; signal?: AbortSignal } = {},
): Promise<AgentStreamResult> => {
  let consecutiveUnknowns = 0;
  let consecutiveFailures = 0;
  const deadline = Date.now() + TURN_RECOVERY_DEADLINE_MS;

  while (Date.now() < deadline) {
    const remainingTime = deadline - Date.now();
    const pollDelay = Math.min(pollIntervalMs, remainingTime);
    if (pollDelay > 0) await sleep(pollDelay, signal);
    throwIfAborted(signal);
    if (Date.now() >= deadline) break;

    let turn: AgentTurnStatus;
    try {
      turn = await runBeforeDeadline(deadline, (requestSignal) => fetchStatus(clientTurnId, requestSignal), signal);
    } catch (error) {
      if (
        error instanceof UnauthorizedError ||
        error instanceof RequestError ||
        error instanceof AgentTurnStatusError
      ) {
        throw error;
      }
      consecutiveFailures += 1;
      // A mid-stream break proves that the server accepted the request, so tolerate an outage until
      // the deadline. Before headers, two failed status reads instead indicate a fully offline device;
      // fail promptly rather than locking its composer for the full recovery window.
      if (interruptionPhase === "request" && consecutiveFailures >= INITIAL_REQUEST_MAX_CONSECUTIVE_FAILURES) {
        throw error;
      }
      continue;
    }
    consecutiveFailures = 0;

    switch (turn.status) {
      case "persisted":
        return {
          reply: turn.message.content,
          proposedAction: turn.message.proposed_action ?? null,
          proposalMessageId: turn.message.proposal_message_id ?? null,
          conversationId: turn.conversationId,
        };
      case "failed":
        throw new Error("Agent turn failed");
      case "in_progress":
        consecutiveUnknowns = 0;
        continue;
      case "unknown":
        // Once the response stream began, the server contract defines unknown as terminal: one
        // retry covers the short gap between committing the response and arming its marker. Before
        // headers, however, the POST may still be queued or running, so only the hard deadline can
        // safely declare it lost without inviting a duplicate turn.
        consecutiveUnknowns += 1;
        if (interruptionPhase === "stream" && consecutiveUnknowns >= TURN_RECOVERY_MAX_CONSECUTIVE_UNKNOWNS) {
          throw new Error("Agent turn was lost");
        }
        continue;
    }
  }

  throw new Error("Agent turn recovery timed out");
};

export const streamAgentMessage = async ({
  messages,
  conversationId,
  clientTurnId,
  accessToken,
  signal,
  handlers = {},
}: {
  messages: ChatMessage[];
  conversationId?: string | null;
  clientTurnId?: string | null;
  accessToken: string;
  signal?: AbortSignal;
  handlers?: AgentStreamHandlers;
}): Promise<AgentStreamResult> => {
  // Abort the request if the server goes quiet for too long. The timer restarts on every
  // received chunk, so a long reply streams fine — only a stalled connection gets cut off.
  const controller = new AbortController();
  const handleExternalAbort = () => controller.abort();
  if (signal?.aborted) handleExternalAbort();
  else signal?.addEventListener("abort", handleExternalAbort, { once: true });
  let timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const resetIdleTimeout = () => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  };

  try {
    const response = await streamingFetch(buildApiUrl("mobile/agent/messages/stream"), {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messages,
        ...(conversationId ? { conversation_id: conversationId } : {}),
        ...(clientTurnId ? { client_turn_id: clientTurnId } : {}),
      }),
      signal: controller.signal,
    }).catch((error: unknown) => {
      if (signal?.aborted) throw error;
      // A transport failure before response headers does not tell us whether the server received
      // the POST. If this request has a stable identity, recover it instead of risking a duplicate.
      if (clientTurnId) throw new AgentStreamInterruptedError({ cause: error, phase: "request" });
      throw error;
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
            proposalMessageId: data.proposal_message_id ?? null,
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
        let chunk: ReadableStreamReadResult<Uint8Array>;
        try {
          chunk = await reader.read();
        } catch (error) {
          throw new AgentStreamInterruptedError({ cause: error });
        }
        const { value, done: streamDone } = chunk;
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
        if (done) return done;
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
        // the interruption error below. Anything else is a real error.
        if (!(error instanceof SyntaxError)) throw error;
      }
    }

    if (!done) throw new AgentStreamInterruptedError();
    return done;
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener("abort", handleExternalAbort);
  }
};
