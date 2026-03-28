import { request, UnauthorizedError } from "@/lib/request";

beforeEach(() => {
  jest.restoreAllMocks();
});

const mockFetch = (status: number, body: string, headers: Record<string, string> = {}) => {
  jest.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    json: () => Promise.resolve(JSON.parse(body)),
    text: () => Promise.resolve(body),
  } as Response);
};

describe("request", () => {
  it("returns parsed JSON on success", async () => {
    mockFetch(200, '{"id": 1}');
    const result = await request<{ id: number }>("https://api.example.com/test");
    expect(result).toEqual({ id: 1 });
  });

  it("throws UnauthorizedError on 401", async () => {
    mockFetch(401, "Unauthorized");
    await expect(request("https://api.example.com/test")).rejects.toThrow(UnauthorizedError);
  });

  it("includes plain-text error body in thrown error (truncated to 200 chars)", async () => {
    const longError = "x".repeat(300);
    mockFetch(500, longError);
    await expect(request("https://api.example.com/test")).rejects.toThrow(
      `Request failed: 500 ${"x".repeat(200)}`,
    );
  });

  it("extracts <title> from HTML error responses instead of including raw HTML", async () => {
    const html = '<!DOCTYPE html><html><head><title>Page not found</title></head><body><h1>404</h1></body></html>';
    mockFetch(404, html);
    await expect(request("https://api.example.com/test")).rejects.toThrow("Request failed: 404 Page not found");
  });

  it("falls back to 'HTML error page' when HTML has no <title>", async () => {
    const html = "<!DOCTYPE html><html><body><h1>Error</h1></body></html>";
    mockFetch(404, html);
    await expect(request("https://api.example.com/test")).rejects.toThrow("Request failed: 404 HTML error page");
  });

  it("detects HTML via content-type header even without DOCTYPE", async () => {
    const html = "<div>Some error</div>";
    mockFetch(500, html, { "content-type": "text/html; charset=utf-8" });
    await expect(request("https://api.example.com/test")).rejects.toThrow("Request failed: 500 HTML error page");
  });
});
