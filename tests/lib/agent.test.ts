/* eslint-disable import/first -- jest.mock must precede imports */
jest.mock("@/lib/env", () => ({
  env: { EXPO_PUBLIC_GUMROAD_API_URL: "https://api.example.com/", EXPO_PUBLIC_MOBILE_TOKEN: "mobile-token" },
}));

const mockFetch = jest.fn();
jest.mock("expo/fetch", () => ({ fetch: (...args: unknown[]) => mockFetch(...args) }));

import {
  AgentStreamInterruptedError,
  AgentTurnStatusError,
  fetchAgentTurnStatus,
  recoverAgentTurn,
  streamAgentMessage,
} from "@/lib/agent";
import { RequestError, UnauthorizedError } from "@/lib/request";

const encoder = new TextEncoder();

const streamResponse = (
  frames: string[],
  {
    ok = true,
    status,
    contentType = "text/event-stream",
    readError,
  }: { ok?: boolean; status?: number; contentType?: string; readError?: Error } = {},
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
            : readError
              ? Promise.reject(readError)
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

  it("preserves an initial stream request error when the request has no recoverable identity", async () => {
    mockFetch.mockRejectedValue(new Error("The network connection was lost."));

    await expect(
      streamAgentMessage({ messages: [{ role: "user", content: "Hi" }], accessToken: "token" }),
    ).rejects.toThrow("The network connection was lost.");
  });

  it("recovers an identified turn when the connection fails before response headers arrive", async () => {
    const transportError = new Error("The network connection was lost.");
    mockFetch.mockRejectedValue(transportError);

    const stream = streamAgentMessage({
      messages: [{ role: "user", content: "Hi" }],
      clientTurnId: "turn-abc",
      accessToken: "token",
    });

    await expect(stream).rejects.toMatchObject({
      name: "AgentStreamInterruptedError",
      cause: transportError,
      phase: "request",
    });
  });

  it("aborts the stream request when its caller leaves", async () => {
    let requestSignal: AbortSignal | undefined;
    mockFetch.mockImplementation((_url: string, options: { signal: AbortSignal }) => {
      requestSignal = options.signal;
      return new Promise<never>((_, reject) => {
        options.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), {
          once: true,
        });
      });
    });
    const controller = new AbortController();
    const stream = streamAgentMessage({
      messages: [{ role: "user", content: "Hi" }],
      clientTurnId: "turn-abc",
      accessToken: "token",
      signal: controller.signal,
    });

    controller.abort();

    await expect(stream).rejects.toMatchObject({ name: "AbortError" });
    expect(requestSignal?.aborted).toBe(true);
  });

  it("preserves the reader error that interrupted an identified turn", async () => {
    const transportError = new Error("The network connection was lost.");
    mockFetch.mockResolvedValue(
      streamResponse(['event: token\ndata: {"text":"Half"}\n\n'], {
        readError: transportError,
      }),
    );

    await expect(
      streamAgentMessage({
        messages: [{ role: "user", content: "Hi" }],
        clientTurnId: "turn-abc",
        accessToken: "token",
      }),
    ).rejects.toMatchObject({ name: "AgentStreamInterruptedError", cause: transportError });
  });

  it("throws AgentStreamInterruptedError when the body reader rejects mid-stream", async () => {
    mockFetch.mockResolvedValue(
      streamResponse(['event: token\ndata: {"text":"Half"}\n\n'], {
        readError: new Error("The network connection was lost."),
      }),
    );

    await expect(
      streamAgentMessage({ messages: [{ role: "user", content: "Hi" }], accessToken: "token" }),
    ).rejects.toThrow(AgentStreamInterruptedError);
  });

  it("returns a completed turn without waiting for the stream to close", async () => {
    mockFetch.mockResolvedValue(
      streamResponse(['event: done\ndata: {"reply":"Hi","proposed_action":null,"conversation_id":"conv-1"}\n\n'], {
        readError: new Error("The network connection was lost."),
      }),
    );

    await expect(
      streamAgentMessage({ messages: [{ role: "user", content: "Hi" }], accessToken: "token" }),
    ).resolves.toMatchObject({ reply: "Hi", conversationId: "conv-1" });
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

describe("recoverAgentTurn", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(0);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("adopts the persisted turn returned by the status endpoint", async () => {
    const fetchStatus = jest.fn().mockResolvedValue({
      status: "persisted",
      conversationId: "conv-recovered",
      message: {
        role: "assistant",
        content: "Recovered reply",
        proposed_action: { type: "api_write", params: { name: "Guide" }, summary: "Create Guide" },
        proposal_message_id: "msg-7",
      },
    });
    const recovery = recoverAgentTurn("turn-abc", fetchStatus);

    await jest.advanceTimersByTimeAsync(3_000);

    await expect(recovery).resolves.toEqual({
      reply: "Recovered reply",
      proposedAction: { type: "api_write", params: { name: "Guide" }, summary: "Create Guide" },
      proposalMessageId: "msg-7",
      conversationId: "conv-recovered",
    });
  });

  it("aborts an in-flight status request at the recovery deadline", async () => {
    let requestSignal: AbortSignal | undefined;
    const fetchStatus = jest.fn((_turnId: string, signal: AbortSignal) => {
      requestSignal = signal;
      return new Promise<never>((_, reject) => {
        signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
      });
    });
    const recovery = recoverAgentTurn("turn-abc", fetchStatus);
    const rejection = expect(recovery).rejects.toThrow("Agent turn recovery timed out");

    await jest.advanceTimersByTimeAsync(180_000);

    await rejection;
    expect(fetchStatus).toHaveBeenCalledTimes(1);
    expect(requestSignal?.aborted).toBe(true);
  });

  it("aborts an in-flight status request and stops polling when the caller leaves", async () => {
    const controller = new AbortController();
    let requestSignal: AbortSignal | undefined;
    const fetchStatus = jest.fn((_turnId: string, signal: AbortSignal) => {
      requestSignal = signal;
      return new Promise<never>((_, reject) => {
        signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
      });
    });
    const recovery = recoverAgentTurn("turn-abc", fetchStatus, { signal: controller.signal });
    const rejection = expect(recovery).rejects.toMatchObject({ name: "AbortError" });

    await jest.advanceTimersByTimeAsync(3_000);
    controller.abort();
    await rejection;
    await jest.advanceTimersByTimeAsync(30_000);

    expect(fetchStatus).toHaveBeenCalledTimes(1);
    expect(requestSignal?.aborted).toBe(true);
  });

  it("does not start another status request when the poll delay reaches the deadline", async () => {
    const fetchStatus = jest.fn(
      () =>
        new Promise<{ status: "in_progress" }>((resolve) => {
          setTimeout(() => resolve({ status: "in_progress" }), 176_500);
        }),
    );
    const recovery = recoverAgentTurn("turn-abc", fetchStatus);
    const rejection = expect(recovery).rejects.toThrow("Agent turn recovery timed out");

    await jest.advanceTimersByTimeAsync(180_000);

    await rejection;
    expect(fetchStatus).toHaveBeenCalledTimes(1);
  });

  it("keeps polling after consecutive network errors until the status endpoint recovers", async () => {
    const fetchStatus = jest
      .fn()
      .mockRejectedValueOnce(new TypeError("Network request failed"))
      .mockRejectedValueOnce(new TypeError("Network request failed"))
      .mockResolvedValue({
        status: "persisted",
        conversationId: "conv-recovered",
        message: { role: "assistant", content: "Recovered after reconnecting" },
      });
    const recovery = recoverAgentTurn("turn-abc", fetchStatus);

    await jest.advanceTimersByTimeAsync(9_000);

    await expect(recovery).resolves.toMatchObject({
      reply: "Recovered after reconnecting",
      conversationId: "conv-recovered",
    });
    expect(fetchStatus).toHaveBeenCalledTimes(3);
  });

  it("fails promptly when both an initial request and its status checks show the device is offline", async () => {
    const fetchStatus = jest.fn().mockRejectedValue(new TypeError("Network request failed"));
    const recovery = recoverAgentTurn("turn-abc", fetchStatus, { interruptionPhase: "request" });
    const rejection = expect(recovery).rejects.toThrow("Network request failed");

    await jest.advanceTimersByTimeAsync(6_000);

    await rejection;
    expect(fetchStatus).toHaveBeenCalledTimes(2);
  });

  it("declares a turn lost after two consecutive unknown statuses and resets that count on progress", async () => {
    const fetchStatus = jest
      .fn()
      .mockResolvedValueOnce({ status: "unknown" })
      .mockResolvedValueOnce({ status: "in_progress" })
      .mockResolvedValue({ status: "unknown" });
    const recovery = recoverAgentTurn("turn-abc", fetchStatus);
    const rejection = expect(recovery).rejects.toThrow("Agent turn was lost");

    await jest.advanceTimersByTimeAsync(12_000);

    await rejection;
    expect(fetchStatus).toHaveBeenCalledTimes(4);
  });

  it("keeps checking an unknown request-phase turn because the server may not have armed its marker yet", async () => {
    const fetchStatus = jest
      .fn()
      .mockResolvedValueOnce({ status: "unknown" })
      .mockResolvedValueOnce({ status: "unknown" })
      .mockResolvedValueOnce({ status: "unknown" })
      .mockResolvedValue({
        status: "persisted",
        conversationId: "conv-recovered",
        message: { role: "assistant", content: "Recovered slow request" },
      });
    const recovery = recoverAgentTurn("turn-abc", fetchStatus, { interruptionPhase: "request" });

    await jest.advanceTimersByTimeAsync(12_000);

    await expect(recovery).resolves.toMatchObject({ reply: "Recovered slow request" });
    expect(fetchStatus).toHaveBeenCalledTimes(4);
  });

  it.each([
    new UnauthorizedError("Unauthorized"),
    new RequestError(422, "Invalid turn id"),
    new AgentTurnStatusError("Feature unavailable"),
  ])("does not retry a non-retryable status error", async (error) => {
    const fetchStatus = jest.fn().mockRejectedValue(error);
    const recovery = recoverAgentTurn("turn-abc", fetchStatus);
    const rejection = expect(recovery).rejects.toBe(error);

    await jest.advanceTimersByTimeAsync(3_000);

    await rejection;
    expect(fetchStatus).toHaveBeenCalledTimes(1);
  });
});

describe("fetchAgentTurnStatus", () => {
  const mockGlobalFetch = jest.fn();
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = mockGlobalFetch as unknown as typeof global.fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
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
    const controller = new AbortController();

    await expect(fetchAgentTurnStatus("turn-abc", "token", controller.signal)).resolves.toEqual({
      status: "in_progress",
    });
    const requestSignal = mockGlobalFetch.mock.calls[0][1].signal as AbortSignal;
    expect(requestSignal.aborted).toBe(false);

    controller.abort();

    expect(requestSignal.aborted).toBe(true);
  });

  it("throws the server's error when the turn id is rejected", async () => {
    mockGlobalFetch.mockResolvedValue(jsonResponse({ success: false, error: "Invalid turn id." }));

    await expect(fetchAgentTurnStatus("bad id", "token")).rejects.toEqual(
      expect.objectContaining({ name: "AgentTurnStatusError", message: "Invalid turn id." }),
    );
  });
});
