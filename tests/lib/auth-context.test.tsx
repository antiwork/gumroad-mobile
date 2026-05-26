import * as Sentry from "@sentry/react-native";
import { renderHook, waitFor } from "@testing-library/react-native";
import * as AuthSession from "expo-auth-session";
import React from "react";

import { AuthProvider, useAuth } from "@/lib/auth-context";
import { request } from "@/lib/request";
import * as SecureStore from "expo-secure-store";

jest.mock("expo-auth-session");
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(true),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
  AFTER_FIRST_UNLOCK: "after_first_unlock_sentinel",
}));
jest.mock("expo-web-browser", () => ({
  maybeCompleteAuthSession: jest.fn(),
}));
jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: jest.fn() }),
}));
jest.mock("@/lib/request", () => ({
  request: jest.fn(),
  UnauthorizedError: class UnauthorizedError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "UnauthorizedError";
    }
  },
}));
jest.mock("@/lib/query-client", () => ({
  queryClient: { clear: jest.fn() },
}));

const mockUseAuthRequest = AuthSession.useAuthRequest as jest.Mock;
const mockMakeRedirectUri = AuthSession.makeRedirectUri as jest.Mock;
const mockRequest = request as jest.Mock;
const mockGetItemAsync = SecureStore.getItemAsync as jest.Mock;
const mockSetItemAsync = SecureStore.setItemAsync as jest.Mock;
const mockDeleteItemAsync = SecureStore.deleteItemAsync as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockMakeRedirectUri.mockReturnValue("gumroadmobile://redirect");
});

const renderWithProvider = (response: AuthSession.AuthSessionResult | null) => {
  mockUseAuthRequest.mockReturnValue([{ codeVerifier: "test-verifier" }, response, jest.fn()]);

  return renderHook(() => useAuth(), {
    wrapper: ({ children }: { children: React.ReactNode }) => <AuthProvider>{children}</AuthProvider>,
  });
};

describe("AuthProvider handleAuthResponse", () => {
  it("does not report access_denied errors to Sentry", async () => {
    renderWithProvider({
      type: "error",
      errorCode: "access_denied",
      error: {
        code: "access_denied",
        message: "The resource owner or authorization server denied the request.",
      } as unknown as AuthSession.AuthError,
      params: {},
      authentication: null,
      url: "",
    });

    await waitFor(() => {
      expect(Sentry.captureException).not.toHaveBeenCalled();
    });
  });

  it("reports other OAuth errors to Sentry", async () => {
    const serverError = { code: "server_error", message: "Something went wrong" } as unknown as AuthSession.AuthError;

    renderWithProvider({
      type: "error",
      errorCode: "server_error",
      error: serverError,
      params: {},
      authentication: null,
      url: "",
    });

    await waitFor(() => {
      expect(Sentry.captureException).toHaveBeenCalledWith(serverError);
    });
  });
});

describe("fetchCreatorStatus Sentry reporting", () => {
  it("does not report UnauthorizedError to Sentry", async () => {
    const { UnauthorizedError } = jest.requireMock("@/lib/request");
    mockGetItemAsync.mockResolvedValue("stored-token");
    mockRequest.mockRejectedValue(new UnauthorizedError("Unauthorized"));

    renderWithProvider(null);

    await waitFor(() => {
      expect(mockRequest).toHaveBeenCalled();
    });

    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("reports non-401 errors to Sentry", async () => {
    const networkError = new Error("Network error");
    mockGetItemAsync.mockResolvedValue("stored-token");
    mockRequest.mockRejectedValue(networkError);

    renderWithProvider(null);

    await waitFor(() => {
      expect(Sentry.captureException).toHaveBeenCalledWith(networkError);
    });
  });
});

describe("refreshToken", () => {
  const refreshTokenStored = (key: string) =>
    key === "gumroad_refresh_token" ? Promise.resolve("stored-refresh") : Promise.resolve(null);

  it("returns the new access token on success", async () => {
    mockGetItemAsync.mockImplementation(refreshTokenStored);
    mockRequest.mockResolvedValue({ access_token: "new-access", refresh_token: "new-refresh" });

    const { result } = renderWithProvider(null);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const newToken = await result.current.refreshToken();
    expect(newToken).toBe("new-access");
  });

  it("stores the new tokens with AFTER_FIRST_UNLOCK accessibility", async () => {
    mockGetItemAsync.mockImplementation(refreshTokenStored);
    mockRequest.mockResolvedValue({ access_token: "new-access", refresh_token: "new-refresh" });

    const { result } = renderWithProvider(null);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await result.current.refreshToken();
    expect(mockSetItemAsync).toHaveBeenCalledWith(
      "gumroad_access_token",
      "new-access",
      expect.objectContaining({ keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK }),
    );
  });

  it("throws when there is no stored refresh token", async () => {
    mockGetItemAsync.mockResolvedValue(null);

    const { result } = renderWithProvider(null);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(result.current.refreshToken()).rejects.toThrow("No refresh token available");
  });

  it("does NOT call logout when refresh fails (caller decides)", async () => {
    mockGetItemAsync.mockImplementation(refreshTokenStored);
    mockRequest.mockRejectedValue(new Error("Network error"));

    const { result } = renderWithProvider(null);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(result.current.refreshToken()).rejects.toThrow("Network error");
    expect(mockDeleteItemAsync).not.toHaveBeenCalled();
  });

  it("dedupes concurrent calls into a single network request", async () => {
    mockGetItemAsync.mockImplementation(refreshTokenStored);
    let resolveRequest: (value: { access_token: string; refresh_token: string }) => void = () => {};
    mockRequest.mockReturnValue(
      new Promise((r) => {
        resolveRequest = r;
      }),
    );

    const { result } = renderWithProvider(null);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const p1 = result.current.refreshToken();
    const p2 = result.current.refreshToken();
    const p3 = result.current.refreshToken();

    resolveRequest({ access_token: "new-access", refresh_token: "new-refresh" });

    const [t1, t2, t3] = await Promise.all([p1, p2, p3]);
    expect(t1).toBe("new-access");
    expect(t2).toBe("new-access");
    expect(t3).toBe("new-access");

    const refreshCalls = mockRequest.mock.calls.filter(([url]) => String(url).includes("/oauth/token"));
    expect(refreshCalls).toHaveLength(1);
  });

  it("allows a second refresh after the first completes", async () => {
    mockGetItemAsync.mockImplementation(refreshTokenStored);
    mockRequest
      .mockResolvedValueOnce({ access_token: "first-access", refresh_token: "first-refresh" })
      .mockResolvedValueOnce({ access_token: "second-access", refresh_token: "second-refresh" });

    const { result } = renderWithProvider(null);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const first = await result.current.refreshToken();
    const second = await result.current.refreshToken();
    expect(first).toBe("first-access");
    expect(second).toBe("second-access");
  });
});

describe("storeTokens ACL", () => {
  const renderForSuccessfulOAuth = () =>
    renderWithProvider({
      type: "success",
      params: { code: "auth-code" },
      authentication: null,
      errorCode: null,
      url: "",
    } as unknown as AuthSession.AuthSessionResult);

  it("deletes existing tokens before setting so the new ACL takes effect", async () => {
    mockGetItemAsync.mockResolvedValue(null);
    mockRequest.mockResolvedValue({ access_token: "new-access", refresh_token: "new-refresh" });

    renderForSuccessfulOAuth();

    await waitFor(() => {
      expect(mockSetItemAsync).toHaveBeenCalledWith(
        "gumroad_access_token",
        "new-access",
        expect.objectContaining({ keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK }),
      );
    });

    const deleteOrder = mockDeleteItemAsync.mock.invocationCallOrder;
    const setOrder = mockSetItemAsync.mock.invocationCallOrder;
    expect(deleteOrder[0]).toBeLessThan(setOrder[0]);
  });

  it("stores the refresh token with AFTER_FIRST_UNLOCK too", async () => {
    mockGetItemAsync.mockResolvedValue(null);
    mockRequest.mockResolvedValue({ access_token: "new-access", refresh_token: "new-refresh" });

    renderForSuccessfulOAuth();

    await waitFor(() => {
      expect(mockSetItemAsync).toHaveBeenCalledWith(
        "gumroad_refresh_token",
        "new-refresh",
        expect.objectContaining({ keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK }),
      );
    });
  });
});
