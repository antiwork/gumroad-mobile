import { request, UnauthorizedError } from "@/lib/request";

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("request", () => {
  it("throws UnauthorizedError when response is redirected to /login", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      redirected: true,
      url: "https://api.gumroad.com/login",
      headers: new Headers(),
    });

    await expect(request("https://api.gumroad.com/api/endpoint")).rejects.toThrow(UnauthorizedError);
  });

  it("throws generic error for non-redirected 404", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      redirected: false,
      url: "https://api.gumroad.com/api/endpoint",
      headers: new Headers(),
    });

    await expect(request("https://api.gumroad.com/api/endpoint")).rejects.toThrow("Request failed: 404 Not found");
  });

  it("throws UnauthorizedError for 401 responses", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      redirected: false,
      url: "https://api.gumroad.com/api/endpoint",
      headers: new Headers(),
    });

    await expect(request("https://api.gumroad.com/api/endpoint")).rejects.toThrow(UnauthorizedError);
  });

  it("returns parsed JSON for successful responses", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      redirected: false,
      url: "https://api.gumroad.com/api/endpoint",
      headers: new Headers(),
      json: () => Promise.resolve({ success: true }),
    });

    const result = await request("https://api.gumroad.com/api/endpoint");
    expect(result).toEqual({ success: true });
  });
});
