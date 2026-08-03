/* eslint-disable import/first -- jest.mock must precede imports */
jest.mock("@/lib/env", () => ({
  env: { EXPO_PUBLIC_GUMROAD_API_URL: "https://api.example.com/", EXPO_PUBLIC_MOBILE_TOKEN: "mobile-token" },
}));

const mockFetch = jest.fn();
jest.mock("expo/fetch", () => ({ fetch: (...args: unknown[]) => mockFetch(...args) }));

import { AgentStreamInterruptedError, fetchAgentTurnStatus, streamAgentMessage } from "@/lib/agent";
import { UnauthorizedError } from "@/lib/request";

const encoder = new TextEncoder();

const streamResponse = (
  frames: string[],
  {
    ok = true,
    status,
    contentType = "text/event-stream",
  }: { ok?: boolean; status?: number; contentType?: string } = {},
) => {
  let index = 0;
  const cancel = jest.fn().mockResolvedValue(undefined);
  return {
    ok,
    status: status ?? (ok ? 200 : 500),
    headers: { get: (name: string) => (name.toLowerCase() === "content-type" ? contentType : null) },
    body: {
      getReader: () => ({
        read: () =>
          index < frames.length
            ? Promise.resolve({ value: encoder.encode(frames[index++]), done: false })
            : Promise.resolve({ value: undefined, done: true }),
        cancel,
      }),
    },
    cancel,
  };
};

describe("streamAgentMessage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("delivers tokens as they arrive and resolves with the done payload", async () => {
    mockFetch.mockResolvedValue(
      streamResponse([
        'event: token\ndata: {"text":"You have "}\n\n',
        'event: token\ndata: {"text":"3 products."}\n\n',
        'event: done\ndata: {"reply":"You have 3 products.","proposed_action":null,"conversation_id":"conv-1"}\n\n',
      ]),
    );
    const onToken = jest.fn();

    const result = await streamAgentMessage({
      messages: [{ role: "user", content: "How many products?" }],
      accessToken: "token",
      handlers: { onToken },
    });

    expect(onToken.mock.calls.map(([text]) => text)).toEqual(["You have ", "3 products."]);
    expect(result).toEqual({
      reply: "You have 3 products.",
      proposedAction: null,
      proposalMessageId: null,
      conversationId: "conv-1",
    });
  });

  it("reassembles frames split across chunks", async () => {
    mockFetch.mockResolvedValue(
      streamResponse([
        'event: token\ndata: {"te',
        'xt":"Hello"}\n\nevent: done\ndata: {"reply":"Hello","proposed_a',
        'ction":null,"conversation_id":"conv-2"}\n\n',
      ]),
    );
    const onToken = jest.fn();

    const result = await streamAgentMessage({
      messages: [{ role: "user", content: "Hi" }],
      accessToken: "token",
      handlers: { onToken },
    });

    expect(onToken).toHaveBeenCalledWith("Hello");
    expect(result.conversationId).toBe("conv-2");
  });

  it("signals a reset so the UI can drop intermediate preamble text", async () => {
    mockFetch.mockResolvedValue(
      streamResponse([
        'event: token\ndata: {"text":"Let me check..."}\n\n',
        "event: reset\ndata: {}\n\n",
        'event: token\ndata: {"text":"Sales are up."}\n\n',
        'event: done\ndata: {"reply":"Sales are up.","proposed_action":null}\n\n',
      ]),
    );
    const onReset = jest.fn();

    const result = await streamAgentMessage({
      messages: [{ role: "user", content: "Sales?" }],
      accessToken: "token",
      handlers: { onReset },
    });

    expect(onReset).toHaveBeenCalledTimes(1);
    expect(result.reply).toBe("Sales are up.");
  });

  it("keeps the conversation id being resumed when done omits one", async () => {
    mockFetch.mockResolvedValue(streamResponse(['event: done\ndata: {"reply":"Ok.","proposed_action":null}\n\n']));

    const result = await streamAgentMessage({
      messages: [{ role: "user", content: "Hi" }],
      conversationId: "conv-existing",
      accessToken: "token",
    });

    expect(result.conversationId).toBe("conv-existing");
  });

  it("throws the server's message on an error event", async () => {
    const response = streamResponse(['event: error\ndata: {"message":"That conversation could not be found."}\n\n']);
    mockFetch.mockResolvedValue(response);

    await expect(
      streamAgentMessage({ messages: [{ role: "user", content: "Hi" }], accessToken: "token" }),
    ).rejects.toThrow("That conversation could not be found.");
    expect(response.cancel).toHaveBeenCalled();
  });

  it("throws UnauthorizedError on a 401 so the caller can refresh the token and retry", async () => {
    mockFetch.mockResolvedValue(streamResponse([], { ok: false, status: 401, contentType: "application/json" }));

    await expect(
      streamAgentMessage({ messages: [{ role: "user", content: "Hi" }], accessToken: "token" }),
    ).rejects.toThrow(UnauthorizedError);
  });

  it("throws when the response is not an event stream", async () => {
    mockFetch.mockResolvedValue(streamResponse([], { ok: false, contentType: "application/json" }));

    await expect(
      streamAgentMessage({ messages: [{ role: "user", content: "Hi" }], accessToken: "token" }),
    ).rejects.toThrow("Agent stream request failed");
  });

  it("throws AgentStreamInterruptedError when the stream ends without a done event", async () => {
    mockFetch.mockResolvedValue(streamResponse(['event: token\ndata: {"text":"Half a re']));

    await expect(
      streamAgentMessage({ messages: [{ role: "user", content: "Hi" }], accessToken: "token" }),
    ).rejects.toThrow(AgentStreamInterruptedError);
  });

  it("sends the client turn id so a broken stream can be recovered by exact identity", async () => {
    mockFetch.mockResolvedValue(
      streamResponse(['event: done\ndata: {"reply":"Hi","proposed_action":null,"conversation_id":"conv-1"}\n\n']),
    );

    await streamAgentMessage({
      messages: [{ role: "user", content: "Hi" }],
      clientTurnId: "turn-abc",
      accessToken: "token",
    });

    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toMatchObject({ client_turn_id: "turn-abc" });
  });

  it("omits the client turn id when none is given", async () => {
    mockFetch.mockResolvedValue(
      streamResponse(['event: done\ndata: {"reply":"Hi","proposed_action":null,"conversation_id":"conv-1"}\n\n']),
    );

    await streamAgentMessage({ messages: [{ role: "user", content: "Hi" }], accessToken: "token" });

    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).not.toHaveProperty("client_turn_id");
  });
});

describe("fetchAgentTurnStatus", () => {
  const mockGlobalFetch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = mockGlobalFetch as unknown as typeof global.fetch;
  });

  const jsonResponse = (payload: unknown) => ({
    ok: true,
    status: 200,
    url: "https://api.example.com/mobile/agent/turns/turn-abc",
    headers: { get: () => "application/json" },
    json: () => Promise.resolve(payload),
  });

  it("returns the stored turn when the server persisted it", async () => {
    mockGlobalFetch.mockResolvedValue(
      jsonResponse({
        success: true,
        status: "persisted",
        conversation_id: "conv-9",
        message: {
          role: "assistant",
          content: "Your product is ready to publish.",
          proposed_action: { type: "api_write", params: { name: "Guide" }, summary: "Create Guide" },
          proposal_message_id: "msg-7",
        },
      }),
    );

    await expect(fetchAgentTurnStatus("turn-abc", "token")).resolves.toEqual({
      status: "persisted",
      conversationId: "conv-9",
      message: {
        role: "assistant",
        content: "Your product is ready to publish.",
        proposed_action: { type: "api_write", params: { name: "Guide" }, summary: "Create Guide" },
        proposal_message_id: "msg-7",
      },
    });
    expect(mockGlobalFetch.mock.calls[0][0]).toContain("mobile/agent/turns/turn-abc");
  });

  it("reports a turn the server is still generating", async () => {
    mockGlobalFetch.mockResolvedValue(jsonResponse({ success: true, status: "in_progress" }));

    await expect(fetchAgentTurnStatus("turn-abc", "token")).resolves.toEqual({ status: "in_progress" });
  });

  it("throws the server's error when the turn id is rejected", async () => {
    mockGlobalFetch.mockResolvedValue(jsonResponse({ success: false, error: "Invalid turn id." }));

    await expect(fetchAgentTurnStatus("bad id", "token")).rejects.toThrow("Invalid turn id.");
  });
});
