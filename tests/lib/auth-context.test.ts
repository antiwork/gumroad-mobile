import { authenticate, isBiometricEnabled, isBiometricSupported } from "@/lib/biometric";

const mockGetItemAsync = jest.fn();
const mockSetItemAsync = jest.fn();
const mockDeleteItemAsync = jest.fn();
jest.mock("expo-secure-store", () => ({
  getItemAsync: (key: string) => mockGetItemAsync(key),
  setItemAsync: (key: string, value: string) => mockSetItemAsync(key, value),
  deleteItemAsync: (key: string) => mockDeleteItemAsync(key),
}));

jest.mock("@/lib/biometric", () => ({
  authenticate: jest.fn(),
  isBiometricEnabled: jest.fn(),
  isBiometricSupported: jest.fn(),
  setBiometricEnabled: jest.fn(),
}));

const mockRequest = jest.fn();
jest.mock("@/lib/request", () => ({
  request: (...args: unknown[]) => mockRequest(...args),
}));

jest.mock("expo-auth-session", () => ({
  makeRedirectUri: () => "test://redirect",
  useAuthRequest: () => [null, null, jest.fn()],
  ResponseType: { Code: "code" },
  maybeCompleteAuthSession: jest.fn(),
}));

jest.mock("expo-web-browser", () => ({
  maybeCompleteAuthSession: jest.fn(),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: jest.fn() }),
}));

import { renderHook, act } from "@testing-library/react-native";
import React from "react";
import { AuthProvider, useAuth } from "@/lib/auth-context";

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(AuthProvider, null, children);

describe("auth-context biometric integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetItemAsync.mockResolvedValue(null);
    (isBiometricEnabled as jest.Mock).mockResolvedValue(false);
    (isBiometricSupported as jest.Mock).mockResolvedValue(false);
  });

  it("exposes canUseBiometric as false when biometric is not enabled", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {});
    expect(result.current.canUseBiometric).toBe(false);
  });

  it("exposes canUseBiometric as true when biometric is enabled and refresh token exists", async () => {
    (isBiometricEnabled as jest.Mock).mockResolvedValue(true);
    mockGetItemAsync.mockImplementation((key: string) => {
      if (key === "gumroad_refresh_token") return Promise.resolve("stored-refresh");
      return Promise.resolve(null);
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {});
    expect(result.current.canUseBiometric).toBe(true);
  });

  it("loginWithBiometrics clears refresh token when refresh fails", async () => {
    (isBiometricEnabled as jest.Mock).mockResolvedValue(true);
    (authenticate as jest.Mock).mockResolvedValue(true);
    mockGetItemAsync.mockImplementation((key: string) => {
      if (key === "gumroad_refresh_token") return Promise.resolve("expired-refresh");
      return Promise.resolve(null);
    });
    mockRequest.mockRejectedValue(new Error("invalid_grant"));

    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {});

    await act(async () => {
      await result.current.loginWithBiometrics();
    });

    expect(result.current.canUseBiometric).toBe(false);
  });

  it("loginWithBiometrics fetches creator status on successful refresh", async () => {
    (isBiometricEnabled as jest.Mock).mockResolvedValue(true);
    (authenticate as jest.Mock).mockResolvedValue(true);
    mockGetItemAsync.mockImplementation((key: string) => {
      if (key === "gumroad_refresh_token") return Promise.resolve("valid-refresh");
      return Promise.resolve(null);
    });
    mockRequest.mockResolvedValue({ access_token: "new-token", refresh_token: "new-refresh" });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {});

    await act(async () => {
      await result.current.loginWithBiometrics();
    });

    expect(result.current.isAuthenticated).toBe(true);
  });

  it("loginWithBiometrics does nothing when biometric auth is cancelled", async () => {
    (isBiometricEnabled as jest.Mock).mockResolvedValue(true);
    (authenticate as jest.Mock).mockResolvedValue(false);
    mockGetItemAsync.mockImplementation((key: string) => {
      if (key === "gumroad_refresh_token") return Promise.resolve("valid-refresh");
      return Promise.resolve(null);
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {});

    await act(async () => {
      await result.current.loginWithBiometrics();
    });

    expect(mockRequest).not.toHaveBeenCalled();
    expect(result.current.isAuthenticated).toBe(false);
  });
});
