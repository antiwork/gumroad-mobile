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
  jest.fn((_url: string, init?: RequestInit) =>
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
    expect(error.name).toBe("AbortError");
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
