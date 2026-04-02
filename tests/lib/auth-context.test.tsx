import * as Sentry from "@sentry/react-native";
import { renderHook, waitFor } from "@testing-library/react-native";
import * as AuthSession from "expo-auth-session";
import React from "react";

import { AuthProvider } from "@/lib/auth-context";
import { request } from "@/lib/request";
import * as SecureStore from "expo-secure-store";

jest.mock("expo-auth-session");
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
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

beforeEach(() => {
  jest.clearAllMocks();
  mockMakeRedirectUri.mockReturnValue("gumroadmobile://redirect");
});

const renderWithProvider = (response: AuthSession.AuthSessionResult | null) => {
  mockUseAuthRequest.mockReturnValue([{ codeVerifier: "test-verifier" }, response, jest.fn()]);

  return renderHook(() => ({}), {
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
