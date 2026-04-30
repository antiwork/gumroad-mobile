const mockFetch = jest.fn();
global.fetch = mockFetch;

const mockCaptureException = jest.fn();
jest.mock("@sentry/react-native", () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

jest.mock("@/lib/env", () => ({
  env: {
    EXPO_PUBLIC_MOBILE_TOKEN: "test-token",
    EXPO_PUBLIC_GUMROAD_API_URL: "https://api.example.com",
  },
}));

jest.mock("react-native", () => ({
  Platform: { OS: "ios" },
  AppState: { addEventListener: jest.fn(() => ({ remove: jest.fn() })) },
}));

jest.mock("@tanstack/react-query", () => ({
  useQuery: jest.fn(),
  QueryClient: jest.fn(),
}));

jest.mock("@/lib/auth-context", () => ({
  useAuth: jest.fn(() => ({ accessToken: "test" })),
}));

import { updateMediaLocation } from "@/lib/media-location";

beforeEach(() => {
  jest.clearAllMocks();
});

const defaultParams = {
  urlRedirectId: "redirect-1",
  productFileId: "file-1",
  location: 42,
  accessToken: "token-abc",
};

const jsonResponse = (status = 200) =>
  Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve("{}"),
  });

describe("updateMediaLocation", () => {
  it("does not report AbortError to Sentry", async () => {
    const abortError = new Error("Aborted");
    abortError.name = "AbortError";
    mockFetch.mockRejectedValueOnce(abortError);

    await updateMediaLocation(defaultParams);

    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it("reports non-AbortError exceptions to Sentry", async () => {
    const networkError = new Error("Network request failed");
    mockFetch.mockRejectedValueOnce(networkError);

    await updateMediaLocation(defaultParams);

    expect(mockCaptureException).toHaveBeenCalledWith(networkError);
  });

  it("does not throw on failure (non-critical sync)", async () => {
    mockFetch.mockRejectedValueOnce(new Error("boom"));

    await expect(updateMediaLocation(defaultParams)).resolves.toBeUndefined();
  });

  it("skips the request when accessToken is null", async () => {
    await updateMediaLocation({ ...defaultParams, accessToken: null });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("sends the correct payload", async () => {
    mockFetch.mockReturnValueOnce(jsonResponse());

    await updateMediaLocation(defaultParams);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("mobile/media_locations"),
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"url_redirect_id":"redirect-1"'),
      }),
    );
  });
});
