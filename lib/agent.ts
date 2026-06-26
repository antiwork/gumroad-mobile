import { requestAPI } from "@/lib/request";

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

// A store change the agent has prepared. It is NOT applied until the seller confirms it, at which
// point we POST it back to the actions endpoint.
export interface ProposedAction {
  type: "create_discount" | "update_product_price" | "publish_product" | "unpublish_product";
  params: Record<string, unknown>;
  summary: string;
}

interface AgentMetaResponse {
  success: boolean;
  enabled: boolean;
  greeting: string;
  suggestions: string[];
}

type SendMessageResponse =
  | { success: true; reply: string; proposed_action: ProposedAction | null }
  | { success: false; error: string };

interface ExecuteActionResponse {
  success: boolean;
  message: string;
}

export const fetchAgentMeta = (accessToken: string) =>
  requestAPI<AgentMetaResponse>("mobile/agent/meta", { method: "GET", accessToken });

export const sendAgentMessage = async ({
  messages,
  accessToken,
}: {
  messages: ChatMessage[];
  accessToken: string;
}): Promise<{ reply: string; proposedAction: ProposedAction | null }> => {
  const json = await requestAPI<SendMessageResponse>("mobile/agent/messages", {
    method: "POST",
    data: { messages },
    accessToken,
  });
  if (!json.success) throw new Error(json.error);
  return { reply: json.reply, proposedAction: json.proposed_action };
};

export const executeAgentAction = async ({
  action,
  accessToken,
}: {
  action: ProposedAction;
  accessToken: string;
}): Promise<string> => {
  const json = await requestAPI<ExecuteActionResponse>("mobile/agent/actions", {
    method: "POST",
    data: { type: action.type, params: action.params },
    accessToken,
  });
  if (!json.success) throw new Error(json.message);
  return json.message;
};
