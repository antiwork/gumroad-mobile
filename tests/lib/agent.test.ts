/* eslint-disable import/first -- jest.mock must precede imports */
jest.mock("@/lib/env", () => ({
  env: { EXPO_PUBLIC_GUMROAD_API_URL: "https://api.example.com/", EXPO_PUBLIC_MOBILE_TOKEN: "mobile-token" },
}));

const mockFetch = jest.fn();
jest.mock("expo/fetch", () => ({ fetch: (...args: unknown[]) => mockFetch(...args) }));

import { streamAgentMessage } from "@/lib/agent";

const encoder = new TextEncoder();

const streamResponse = (frames: string[], { ok = true, contentType = "text/event-stream" } = {}) => {
  let index = 0;
  return {
    ok,
    status: ok ? 200 : 500,
    headers: { get: (name: string) => (name.toLowerCase() === "content-type" ? contentType : null) },
    body: {
      getReader: () => ({
        read: () =>
          index < frames.length
            ? Promise.resolve({ value: encoder.encode(frames[index++]), done: false })
            : Promise.resolve({ value: undefined, done: true }),
      }),
    },
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
    expect(result).toEqual({ reply: "You have 3 products.", proposedAction: null, conversationId: "conv-1" });
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
    mockFetch.mockResolvedValue(
      streamResponse(['event: error\ndata: {"message":"That conversation could not be found."}\n\n']),
    );

    await expect(
      streamAgentMessage({ messages: [{ role: "user", content: "Hi" }], accessToken: "token" }),
    ).rejects.toThrow("That conversation could not be found.");
  });

  it("throws when the response is not an event stream", async () => {
    mockFetch.mockResolvedValue(streamResponse([], { ok: false, contentType: "application/json" }));

    await expect(
      streamAgentMessage({ messages: [{ role: "user", content: "Hi" }], accessToken: "token" }),
    ).rejects.toThrow("Agent stream request failed");
  });

  it("throws when the stream ends without a done event", async () => {
    mockFetch.mockResolvedValue(streamResponse(['event: token\ndata: {"text":"Half a re']));

    await expect(
      streamAgentMessage({ messages: [{ role: "user", content: "Hi" }], accessToken: "token" }),
    ).rejects.toThrow("Agent stream ended without a done event");
  });
});
