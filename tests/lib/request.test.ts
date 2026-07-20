import { request, ServerError, StaleResponseError, UnauthorizedError } from "@/lib/request";

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

  it("throws StaleResponseError when the response body's blob was purged (app suspended)", async () => {
    mockFetch.mockReturnValueOnce(
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.reject(new Error("Unable to resolve data for blob: 8e39a7c2-1f4b-4b6e-9a70-000000000000")),
        text: () => Promise.resolve(""),
      }),
    );
    await expect(request("https://api.example.com/test")).rejects.toThrow(StaleResponseError);
  });

  it("leaves non-blob body read failures untouched", async () => {
    mockFetch.mockReturnValueOnce(
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.reject(new SyntaxError("Unexpected token < in JSON")),
        text: () => Promise.resolve(""),
      }),
    );
    await expect(request("https://api.example.com/test")).rejects.toThrow(SyntaxError);
  });

  it("throws UnauthorizedError on 401", async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({}, 401));
    await expect(request("https://api.example.com/test")).rejects.toThrow(UnauthorizedError);
  });

  it("throws UnauthorizedError when the API redirects an unauthenticated request to /login (404)", async () => {
    mockFetch.mockReturnValueOnce(
      Promise.resolve({
        ok: false,
        status: 404,
        redirected: true,
        url: "https://api.example.com/login",
        json: () => Promise.resolve({}),
        text: () => Promise.resolve("Not Found"),
      }),
    );
    await expect(request("https://api.example.com/v2/things")).rejects.toThrow(UnauthorizedError);
  });

  it("does not treat a direct request to /login as unauthorized", async () => {
    mockFetch.mockReturnValueOnce(
      Promise.resolve({
        ok: false,
        status: 404,
        redirected: true,
        url: "https://api.example.com/login",
        json: () => Promise.resolve({}),
        text: () => Promise.resolve("Not Found"),
      }),
    );
    await expect(request("https://api.example.com/login")).rejects.toThrow("Request failed: 404 Not found");
  });

  it("still throws the generic 404 error when the response was not redirected", async () => {
    mockFetch.mockReturnValueOnce(
      Promise.resolve({
        ok: false,
        status: 404,
        redirected: false,
        url: "https://api.example.com/test",
        json: () => Promise.resolve({}),
        text: () => Promise.resolve("Not Found"),
      }),
    );
    await expect(request("https://api.example.com/test")).rejects.toThrow("Request failed: 404 Not found");
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

  it("throws ServerError on 5xx responses", async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({ error: "bad" }, 500));
    const thrown = (await request("https://api.example.com/test").catch((e) => e)) as ServerError;
    expect(thrown).toBeInstanceOf(ServerError);
    expect(thrown.statusCode).toBe(500);
    expect(thrown.message).toBe("Request failed: 500");
  });

  it("throws ServerError on 502 with HTML body without including the body in the message", async () => {
    const cloudflareHtml = "<html><body>Ran out of time — we weren't able to render the page in time</body></html>";
    mockFetch.mockReturnValueOnce(
      Promise.resolve({
        ok: false,
        status: 502,
        json: () => Promise.resolve({}),
        text: () => Promise.resolve(cloudflareHtml),
      }),
    );
    const thrown = (await request("https://api.example.com/test").catch((e) => e)) as ServerError;
    expect(thrown).toBeInstanceOf(ServerError);
    expect(thrown.statusCode).toBe(502);
    expect(thrown.message).toBe("Request failed: 502");
    expect(thrown.message).not.toContain("Ran out of time");
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
