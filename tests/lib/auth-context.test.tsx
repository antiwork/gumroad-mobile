import { renderHook, waitFor, act } from "@testing-library/react-native";
import React from "react";

const mockGetItemAsync = jest.fn();
const mockSetItemAsync = jest.fn();
const mockDeleteItemAsync = jest.fn();
jest.mock("expo-secure-store", () => ({
  getItemAsync: (...args: unknown[]) => mockGetItemAsync(...args),
  setItemAsync: (...args: unknown[]) => mockSetItemAsync(...args),
  deleteItemAsync: (...args: unknown[]) => mockDeleteItemAsync(...args),
}));

const mockRequest = jest.fn();
jest.mock("@/lib/request", () => ({
  request: (...args: unknown[]) => mockRequest(...args),
  UnauthorizedError: class extends Error {
    constructor(message: string) {
      super(message);
      this.name = "UnauthorizedError";
    }
  },
}));

jest.mock("@/lib/query-client", () => ({
  queryClient: { clear: jest.fn() },
}));

jest.mock("@/lib/assert", () => ({
  assertDefined: <T,>(value: T) => value,
}));

const mockReplace = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock("expo-auth-session", () => ({
  makeRedirectUri: () => "gumroadmobile://redirect",
  useAuthRequest: () => [null, null, jest.fn()],
  ResponseType: { Code: "code" },
}));

jest.mock("expo-web-browser", () => ({
  maybeCompleteAuthSession: jest.fn(),
}));

import * as Sentry from "@sentry/react-native";
import { UnauthorizedError } from "@/lib/request";
import { AuthProvider, useAuth } from "@/lib/auth-context";

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(AuthProvider, null, children);

beforeEach(() => {
  jest.clearAllMocks();
});

describe("fetchCreatorStatus", () => {
  it("does not report UnauthorizedError to Sentry", async () => {
    mockGetItemAsync.mockResolvedValueOnce("expired-token");
    mockGetItemAsync.mockResolvedValueOnce(null);
    mockRequest.mockRejectedValueOnce(new UnauthorizedError("Unauthorized"));

    renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(Sentry.captureException).not.toHaveBeenCalledWith(
        expect.objectContaining({ name: "UnauthorizedError" }),
      );
    });
  });

  it("reports non-UnauthorizedError exceptions to Sentry", async () => {
    const networkError = new Error("Network failure");
    mockGetItemAsync.mockResolvedValueOnce("valid-token");
    mockRequest.mockRejectedValueOnce(networkError);

    renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(Sentry.captureException).toHaveBeenCalledWith(networkError);
    });
  });
});

describe("loadStoredAuth with expired token", () => {
  it("refreshes the token when fetchCreatorStatus returns UnauthorizedError", async () => {
    mockGetItemAsync
      .mockResolvedValueOnce("expired-token")
      .mockResolvedValueOnce("stored-refresh-token");

    mockRequest
      .mockRejectedValueOnce(new UnauthorizedError("Unauthorized"))
      .mockResolvedValueOnce({ access_token: "new-token", refresh_token: "new-refresh" })
      .mockResolvedValueOnce({ products: [{ id: "1" }] });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockSetItemAsync).toHaveBeenCalledWith("gumroad_access_token", "new-token");
    expect(mockSetItemAsync).toHaveBeenCalledWith("gumroad_refresh_token", "new-refresh");
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.isCreator).toBe(true);
  });

  it("clears tokens when refresh also fails", async () => {
    mockGetItemAsync
      .mockResolvedValueOnce("expired-token")
      .mockResolvedValueOnce("stored-refresh-token");

    mockRequest
      .mockRejectedValueOnce(new UnauthorizedError("Unauthorized"))
      .mockRejectedValueOnce(new Error("Refresh failed"));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockDeleteItemAsync).toHaveBeenCalledWith("gumroad_access_token");
    expect(mockDeleteItemAsync).toHaveBeenCalledWith("gumroad_refresh_token");
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("clears access token when no refresh token is available", async () => {
    mockGetItemAsync
      .mockResolvedValueOnce("expired-token")
      .mockResolvedValueOnce(null);

    mockRequest.mockRejectedValueOnce(new UnauthorizedError("Unauthorized"));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockDeleteItemAsync).toHaveBeenCalledWith("gumroad_access_token");
    expect(result.current.isAuthenticated).toBe(false);
  });
});
