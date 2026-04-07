import { request, UnauthorizedError, ServerError } from "@/lib/request";

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

const htmlResponse = (html: string, status: number) =>
  Promise.resolve({
    ok: false,
    status,
    json: () => Promise.reject(new Error("not json")),
    text: () => Promise.resolve(html),
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

  it("throws on non-ok responses", async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({ error: "bad" }, 500));
    await expect(request("https://api.example.com/test")).rejects.toThrow(ServerError);
    await expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("throws ServerError with clean message for 530 HTML response", async () => {
    const cloudflareHtml = `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE html><html><head><title>Maintenance | Gumroad</title></head><body><h1>Site under maintenance</h1>${"<p>lots of html</p>".repeat(500)}</body></html>`;
    mockFetch.mockReturnValueOnce(htmlResponse(cloudflareHtml, 530));
    const error: ServerError = await request("https://api.example.com/test").catch((e) => e);
    expect(error).toBeInstanceOf(ServerError);
    expect(error.status).toBe(530);
    expect(error.message).toBe("Request failed: 530 Maintenance | Gumroad");
    expect(error.message).not.toContain("<html>");
  });

  it("throws ServerError with JSON body for 503 non-HTML response", async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({ error: "service unavailable" }, 503));
    const error: ServerError = await request("https://api.example.com/test").catch((e) => e);
    expect(error).toBeInstanceOf(ServerError);
    expect(error.status).toBe(503);
    expect(error.message).toContain('{"error":"service unavailable"}');
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
