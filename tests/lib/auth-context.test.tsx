import { AuthProvider, useAuth } from "@/lib/auth-context";
import { renderHook, act, waitFor } from "@testing-library/react-native";
import * as SecureStore from "expo-secure-store";
import React, { ReactNode } from "react";

const mockPromptAsync = jest.fn();
let mockResponse: unknown = null;

jest.mock("expo-auth-session", () => ({
  useAuthRequest: () => [
    { codeVerifier: "test-verifier" },
    mockResponse,
    mockPromptAsync,
  ],
  makeRedirectUri: () => "gumroadmobile://redirect",
  ResponseType: { Code: "code" },
}));

jest.mock("expo-web-browser", () => ({
  maybeCompleteAuthSession: jest.fn(),
}));

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: jest.fn() }),
}));

const mockRequest = jest.fn();
jest.mock("@/lib/request", () => ({
  request: (...args: unknown[]) => mockRequest(...args),
}));

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;

describe("AuthProvider login flow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResponse = null;
    mockPromptAsync.mockResolvedValue(undefined);
  });

  it("sets loading to true when login is called", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.login();
    });

    expect(result.current.isLoading).toBe(true);
  });

  it("passes ephemeral session option to promptAsync", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.login();
    });

    expect(mockPromptAsync).toHaveBeenCalledWith({
      preferEphemeralSession: true,
    });
  });

  it("surfaces error when token exchange fails", async () => {
    mockRequest.mockRejectedValueOnce(new Error("Network error"));
    mockResponse = {
      type: "success",
      params: { code: "auth-code" },
    };

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.error).toBe("Network error"));
    expect(result.current.isLoading).toBe(false);
  });

  it("surfaces error on auth error response", async () => {
    mockResponse = {
      type: "error",
      error: { message: "Access denied" },
    };

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.error).toBe("Access denied"));
    expect(result.current.isLoading).toBe(false);
  });

  it("uses fallback message when auth error has no message", async () => {
    mockResponse = {
      type: "error",
      error: {},
    };

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.error).toBe("Authentication failed"));
  });

  it("resets loading on cancel response", async () => {
    mockResponse = { type: "cancel" };

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeNull();
  });

  it("resets loading on dismiss response", async () => {
    mockResponse = { type: "dismiss" };

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeNull();
  });

  it("clears previous error on new login attempt", async () => {
    mockResponse = {
      type: "error",
      error: { message: "Previous failure" },
    };

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.error).toBe("Previous failure"));

    await act(async () => {
      await result.current.login();
    });

    expect(result.current.error).toBeNull();
  });

  it("stores tokens and sets authenticated on successful exchange", async () => {
    mockRequest.mockResolvedValueOnce({
      access_token: "new-token",
      refresh_token: "new-refresh",
    });
    mockRequest.mockResolvedValueOnce({ products: [] });
    mockResponse = {
      type: "success",
      params: { code: "auth-code" },
    };

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith("gumroad_access_token", "new-token");
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith("gumroad_refresh_token", "new-refresh");
    expect(result.current.error).toBeNull();
  });
});
