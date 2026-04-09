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

/** Returns a fetch mock that blocks until the signal is aborted, then rejects like real fetch. */
const hangingFetch = () =>
  jest.fn(
    (_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted.", "AbortError"));
        });
      }),
  );

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

  it("throws a clean error on 403 without leaking the response body", async () => {
    const xmlBody = '<?xml version="1.0" encoding="UTF-8"?><Error><Code>AccessDenied</Code></Error>';
    mockFetch.mockReturnValueOnce(
      Promise.resolve({
        ok: false,
        status: 403,
        json: () => Promise.resolve({}),
        text: () => Promise.resolve(xmlBody),
      }),
    );
    await expect(request("https://api.example.com/test")).rejects.toThrow("Request failed: 403 Access denied");
  });

  it("throws a clean error on 404 without leaking the response body", async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({}, 404));
    await expect(request("https://api.example.com/test")).rejects.toThrow("Request failed: 404 Not found");
  });

  it("throws on non-ok responses", async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({ error: "bad" }, 500));
    await expect(request("https://api.example.com/test")).rejects.toThrow("Request failed: 500");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("retries on 502 and succeeds on retry", async () => {
    mockFetch
      .mockReturnValueOnce(jsonResponse("<html>Bad Gateway</html>", 502))
      .mockReturnValueOnce(jsonResponse({ ok: true }));
    const promise = request("https://api.example.com/test");
    await jest.advanceTimersByTimeAsync(500);
    const result = await promise;
    expect(result).toEqual({ ok: true });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("retries on 503 and succeeds on retry", async () => {
    mockFetch
      .mockReturnValueOnce(jsonResponse("Service Unavailable", 503))
      .mockReturnValueOnce(jsonResponse({ ok: true }));
    const promise = request("https://api.example.com/test");
    await jest.advanceTimersByTimeAsync(500);
    const result = await promise;
    expect(result).toEqual({ ok: true });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("retries on 504 and succeeds on retry", async () => {
    mockFetch.mockReturnValueOnce(jsonResponse("Gateway Timeout", 504)).mockReturnValueOnce(jsonResponse({ ok: true }));
    const promise = request("https://api.example.com/test");
    await jest.advanceTimersByTimeAsync(500);
    const result = await promise;
    expect(result).toEqual({ ok: true });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("throws after all retries are exhausted for 502", async () => {
    mockFetch
      .mockReturnValueOnce(jsonResponse("<html>Bad Gateway</html>", 502))
      .mockReturnValueOnce(jsonResponse("<html>Bad Gateway</html>", 502))
      .mockReturnValueOnce(jsonResponse("<html>Bad Gateway</html>", 502));
    const promise = request("https://api.example.com/test").catch((e: Error) => e);
    await jest.advanceTimersByTimeAsync(1500);
    const error = await promise;
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch("Request failed: 502");
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("uses exponential backoff between retries", async () => {
    mockFetch
      .mockReturnValueOnce(jsonResponse("", 502))
      .mockReturnValueOnce(jsonResponse("", 502))
      .mockReturnValueOnce(jsonResponse({ ok: true }));
    const promise = request("https://api.example.com/test");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(499);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(999);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(1);
    expect(mockFetch).toHaveBeenCalledTimes(3);
    const result = await promise;
    expect(result).toEqual({ ok: true });
  });

  it("does not retry 400 errors", async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({ error: "bad request" }, 400));
    await expect(request("https://api.example.com/test")).rejects.toThrow("Request failed: 400");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("does not retry 401 errors", async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({}, 401));
    await expect(request("https://api.example.com/test")).rejects.toThrow(UnauthorizedError);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("does not retry 500 errors", async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({ error: "internal" }, 500));
    await expect(request("https://api.example.com/test")).rejects.toThrow("Request failed: 500");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("aborts the request after 30s timeout", async () => {
    const mock = hangingFetch();
    mockFetch.mockImplementation(mock);

    const promise = request("https://api.example.com/test").catch((e) => e);

    await jest.advanceTimersByTimeAsync(30_000);

    const error = await promise;
    expect(error).toBeInstanceOf(DOMException);
    expect((error as DOMException).name).toBe("AbortError");
  });

  it("respects an external abort signal", async () => {
    const externalController = new AbortController();
    const mock = hangingFetch();
    mockFetch.mockImplementation(mock);

    const promise = request("https://api.example.com/test", { signal: externalController.signal });

    externalController.abort();

    await expect(promise).rejects.toThrow("aborted");
  });
});
