import * as Sentry from "@sentry/react-native";
import { renderHook, waitFor } from "@testing-library/react-native";
import * as AuthSession from "expo-auth-session";
import React from "react";

import { AuthProvider } from "@/lib/auth-context";

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
jest.mock("@/lib/assert", () => ({
  assertDefined: <T,>(value: T) => value,
}));
jest.mock("@/lib/request", () => ({
  request: jest.fn(),
}));
jest.mock("@/lib/query-client", () => ({
  queryClient: { clear: jest.fn() },
}));

const mockUseAuthRequest = AuthSession.useAuthRequest as jest.Mock;
const mockMakeRedirectUri = AuthSession.makeRedirectUri as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockMakeRedirectUri.mockReturnValue("gumroadmobile://redirect");
});

const renderWithProvider = (response: AuthSession.AuthSessionResult | null) => {
  mockUseAuthRequest.mockReturnValue([
    { codeVerifier: "test-verifier" },
    response,
    jest.fn(),
  ]);

  return renderHook(() => ({}), {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    ),
  });
};

describe("AuthProvider handleAuthResponse", () => {
  it("does not report access_denied errors to Sentry", async () => {
    renderWithProvider({
      type: "error",
      error: { code: "access_denied", message: "The resource owner or authorization server denied the request." } as unknown as AuthSession.AuthError,
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
      error: serverError,
      url: "",
    });

    await waitFor(() => {
      expect(Sentry.captureException).toHaveBeenCalledWith(serverError);
    });
  });
});
