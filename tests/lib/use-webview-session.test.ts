import { act, renderHook, waitFor } from "@testing-library/react-native";

const mockUseAuth = jest.fn();
const mockCaptureException = jest.fn();

jest.mock("@/lib/auth-context", () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock("@sentry/react-native", () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

import { useWebViewSession } from "@/lib/use-webview-session";
import { KeychainUnavailableError } from "@/lib/request";

const buildUrl = (token: string) => `https://example.com/settings/profile?access_token=${token}`;

describe("useWebViewSession", () => {
  const mockRefreshToken = jest.fn();
  const mockLogout = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockRefreshToken.mockResolvedValue("refreshed-token");
    mockLogout.mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({
      isLoading: false,
      accessToken: "original-token",
      refreshToken: mockRefreshToken,
      logout: mockLogout,
    });
  });

  it("ignores navigation that is not the Gumroad login page", () => {
    const { result } = renderHook(() => useWebViewSession(buildUrl));

    expect(result.current.handleAuthenticationNavigation("https://example.com/settings/profile")).toBe(false);
    expect(result.current.handleAuthenticationNavigation("https://external.example/login")).toBe(false);
    expect(mockRefreshToken).not.toHaveBeenCalled();
  });

  it("refreshes the native session and rebuilds the intended URL when the WebView reaches login", async () => {
    const { result } = renderHook(() => useWebViewSession(buildUrl));

    act(() => {
      expect(
        result.current.handleAuthenticationNavigation(
          "https://example.com/login?next=%2Fsettings%2Fprofile%3Fdisplay%3Dmobile_app",
        ),
      ).toBe(true);
    });

    await waitFor(() => {
      expect(result.current.url).toBe("https://example.com/settings/profile?access_token=refreshed-token");
      expect(result.current.isLoading).toBe(false);
    });
    expect(mockRefreshToken).toHaveBeenCalledTimes(1);
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it("refreshes the native session when Gumroad rejects the main document token", async () => {
    const { result } = renderHook(() => useWebViewSession(buildUrl));

    act(() => {
      expect(
        result.current.handleAuthenticationHttpError({
          statusCode: 401,
          url: "https://example.com/settings/profile",
        }),
      ).toBe(true);
    });

    await waitFor(() => {
      expect(result.current.url).toBe("https://example.com/settings/profile?access_token=refreshed-token");
    });
    expect(mockRefreshToken).toHaveBeenCalledTimes(1);
  });

  it("ignores HTTP errors that do not reject the Gumroad session", () => {
    const { result } = renderHook(() => useWebViewSession(buildUrl));

    expect(
      result.current.handleAuthenticationHttpError({
        statusCode: 500,
        url: "https://example.com/settings/profile",
      }),
    ).toBe(false);
    expect(
      result.current.handleAuthenticationHttpError({
        statusCode: 401,
        url: "https://external.example/settings/profile",
      }),
    ).toBe(false);
    expect(mockRefreshToken).not.toHaveBeenCalled();
  });

  it("ends the native session when a refreshed token is also rejected", async () => {
    const { result } = renderHook(() => useWebViewSession(buildUrl));

    act(() => {
      result.current.handleAuthenticationNavigation("https://example.com/login");
    });
    await waitFor(() => {
      expect(result.current.url).toContain("refreshed-token");
    });

    act(() => {
      expect(result.current.handleAuthenticationNavigation("https://example.com/login")).toBe(true);
    });

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalledTimes(1);
    });
    expect(mockRefreshToken).toHaveBeenCalledTimes(1);
  });

  it("preserves the one-refresh guard when auth context publishes the refreshed token first", async () => {
    const auth = {
      isLoading: false,
      accessToken: "original-token",
      refreshToken: mockRefreshToken,
      logout: mockLogout,
    };
    let resolveRefresh: ((token: string) => void) | undefined;
    mockUseAuth.mockImplementation(() => auth);
    mockRefreshToken.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveRefresh = resolve;
        }),
    );
    const { result, rerender } = renderHook(() => useWebViewSession(buildUrl));

    act(() => {
      result.current.handleAuthenticationNavigation("https://example.com/login");
    });
    await waitFor(() => {
      expect(mockRefreshToken).toHaveBeenCalledTimes(1);
    });

    act(() => {
      auth.accessToken = "refreshed-token";
      rerender({});
    });
    await act(async () => {
      resolveRefresh?.("refreshed-token");
    });
    await waitFor(() => {
      expect(result.current.url).toContain("refreshed-token");
    });

    act(() => {
      result.current.handleAuthenticationNavigation("https://example.com/login");
    });
    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalledTimes(1);
    });
    expect(mockRefreshToken).toHaveBeenCalledTimes(1);
  });

  it("ends the native session and reports an unexpected refresh failure", async () => {
    const error = new Error("Refresh failed");
    mockRefreshToken.mockRejectedValue(error);
    const { result } = renderHook(() => useWebViewSession(buildUrl));

    act(() => {
      result.current.handleAuthenticationNavigation("https://example.com/login");
    });

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalledTimes(1);
    });
    expect(mockCaptureException).toHaveBeenCalledWith(error, {
      tags: { auth_path: "webview_refresh_failed" },
    });
  });

  it("keeps the native session when the keychain is temporarily unavailable", async () => {
    mockRefreshToken.mockRejectedValueOnce(new KeychainUnavailableError()).mockResolvedValueOnce("refreshed-token");
    const { result } = renderHook(() => useWebViewSession(buildUrl));

    act(() => {
      result.current.handleAuthenticationNavigation("https://example.com/login");
    });
    await waitFor(() => {
      expect(mockRefreshToken).toHaveBeenCalledTimes(1);
    });

    act(() => {
      result.current.handleAuthenticationNavigation("https://example.com/login");
    });
    await waitFor(() => {
      expect(result.current.url).toBe("https://example.com/settings/profile?access_token=refreshed-token");
    });
    expect(mockRefreshToken).toHaveBeenCalledTimes(2);
    expect(mockLogout).not.toHaveBeenCalled();
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it("uses a token refreshed by another native request", async () => {
    const auth = {
      isLoading: false,
      accessToken: "original-token",
      refreshToken: mockRefreshToken,
      logout: mockLogout,
    };
    mockUseAuth.mockImplementation(() => auth);
    const { result, rerender } = renderHook(() => useWebViewSession(buildUrl));

    auth.accessToken = "externally-refreshed-token";
    rerender({});

    await waitFor(() => {
      expect(result.current.url).toBe("https://example.com/settings/profile?access_token=externally-refreshed-token");
    });
  });

  it("pins an editing session until its WebView rejects the old token", async () => {
    const auth = {
      isLoading: false,
      accessToken: "original-token",
      refreshToken: mockRefreshToken,
      logout: mockLogout,
    };
    mockUseAuth.mockImplementation(() => auth);
    const { result, rerender } = renderHook(() =>
      useWebViewSession(buildUrl, {
        syncExternalToken: false,
      }),
    );

    auth.accessToken = "externally-refreshed-token";
    rerender({});

    expect(result.current.url).toBe("https://example.com/settings/profile?access_token=original-token");

    act(() => {
      expect(
        result.current.handleAuthenticationHttpError({
          statusCode: 401,
          url: "https://example.com/profile",
        }),
      ).toBe(true);
    });

    await waitFor(() => {
      expect(result.current.url).toBe("https://example.com/settings/profile?access_token=externally-refreshed-token");
    });
    expect(mockRefreshToken).not.toHaveBeenCalled();
  });
});
