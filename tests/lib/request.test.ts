import { request, UnauthorizedError } from "@/lib/request";

const mockFetch = jest.fn();
global.fetch = mockFetch;

jest.mock("@/lib/env", () => ({
  env: {
    EXPO_PUBLIC_MOBILE_TOKEN: "test-token",
    EXPO_PUBLIC_GUMROAD_API_URL: "https://api.example.com",
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

const jsonResponse = (data: unknown, status = 200) =>
  Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  });

describe("request", () => {
  it("returns data on success", async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({ id: 1 }));
    const result = await request("https://api.example.com/test");
    expect(result).toEqual({ id: 1 });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("throws UnauthorizedError on 401", async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({}, 401));
    await expect(request("https://api.example.com/test")).rejects.toThrow(UnauthorizedError);
  });

  it("does not retry on non-transient errors", async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({ error: "bad" }, 500));
    await expect(request("https://api.example.com/test")).rejects.toThrow("Request failed: 500");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("retries on transient network timeout and succeeds", async () => {
    mockFetch
      .mockRejectedValueOnce(new TypeError("Network request timed out"))
      .mockReturnValueOnce(jsonResponse({ ok: true }));

    const promise = request("https://api.example.com/test");
    await jest.advanceTimersByTimeAsync(1000);
    const result = await promise;

    expect(result).toEqual({ ok: true });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("retries on transient network failure and succeeds", async () => {
    mockFetch
      .mockRejectedValueOnce(new TypeError("Network request failed"))
      .mockReturnValueOnce(jsonResponse({ ok: true }));

    const promise = request("https://api.example.com/test");
    await jest.advanceTimersByTimeAsync(1000);
    const result = await promise;

    expect(result).toEqual({ ok: true });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("throws after exhausting all retries", async () => {
    mockFetch.mockRejectedValue(new TypeError("Network request timed out"));

    let caughtError: unknown;
    const promise = request("https://api.example.com/test").catch((e) => {
      caughtError = e;
    });
    await jest.advanceTimersByTimeAsync(5000);
    await promise;
    expect(caughtError).toBeInstanceOf(TypeError);
    expect((caughtError as TypeError).message).toBe("Network request timed out");
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("uses exponential backoff between retries", async () => {
    const error = new TypeError("Network request timed out");
    mockFetch
      .mockRejectedValueOnce(error)
      .mockRejectedValueOnce(error)
      .mockReturnValueOnce(jsonResponse({ ok: true }));

    const promise = request("https://api.example.com/test");

    await jest.advanceTimersByTimeAsync(999);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(1);
    expect(mockFetch).toHaveBeenCalledTimes(2);

    await jest.advanceTimersByTimeAsync(2000);
    const result = await promise;
    expect(result).toEqual({ ok: true });
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});
