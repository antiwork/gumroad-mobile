import { act, renderHook, waitFor } from "@testing-library/react-native";
import React from "react";

const mockSetItemAsync = jest.fn();
const mockGetItemAsync = jest.fn();
const mockDeleteItemAsync = jest.fn();
jest.mock("expo-secure-store", () => ({
  setItemAsync: (...args: unknown[]) => mockSetItemAsync(...args),
  getItemAsync: (...args: unknown[]) => mockGetItemAsync(...args),
  deleteItemAsync: (...args: unknown[]) => mockDeleteItemAsync(...args),
}));

const mockReplace = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

const mockRequest = jest.fn();
jest.mock("@/lib/request", () => ({
  request: (...args: unknown[]) => mockRequest(...args),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

import { AuthProvider, useAuth } from "@/lib/auth-context";

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(AuthProvider, null, children);

describe("login", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetItemAsync.mockResolvedValue(null);
    mockRequest.mockResolvedValue({ products: [] });
  });

  it("exchanges email and password for tokens and stores them", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ access_token: "new-token", refresh_token: "new-refresh" }),
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.login("user@example.com", "password123");
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/oauth/token"),
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"grant_type":"password"'),
      }),
    );
    expect(mockSetItemAsync).toHaveBeenCalledWith("gumroad_access_token", "new-token");
    expect(mockSetItemAsync).toHaveBeenCalledWith("gumroad_refresh_token", "new-refresh");
    expect(result.current.isAuthenticated).toBe(true);
  });

  it("checks creator status after login", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ access_token: "creator-token" }),
    });
    mockRequest.mockResolvedValue({ products: [{ id: "1" }] });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.login("creator@example.com", "pass");
    });

    expect(result.current.isCreator).toBe(true);
  });

  it("throws a friendly message on invalid credentials", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "invalid_grant", error_description: "The provided authorization grant is invalid." }),
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(act(() => result.current.login("user@example.com", "wrong"))).rejects.toThrow(
      "Invalid email or password",
    );
  });

  it("throws a generic message when error response is not JSON", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.reject(new Error("not json")),
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(act(() => result.current.login("user@example.com", "wrong"))).rejects.toThrow(
      "Login failed. Please try again.",
    );
  });

  it("propagates network errors", async () => {
    mockFetch.mockRejectedValue(new TypeError("Network request failed"));

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(act(() => result.current.login("user@example.com", "pass"))).rejects.toThrow(
      "Network request failed",
    );
  });
});

describe("stored auth", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequest.mockResolvedValue({ products: [] });
  });

  it("loads stored token on mount and sets isAuthenticated", async () => {
    mockGetItemAsync.mockResolvedValue("stored-token");
    mockRequest.mockResolvedValue({ products: [{ id: "1" }] });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.isCreator).toBe(true);
  });

  it("remains unauthenticated when no stored token exists", async () => {
    mockGetItemAsync.mockResolvedValue(null);

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isAuthenticated).toBe(false);
  });
});

describe("logout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetItemAsync.mockResolvedValue(null);
    mockRequest.mockResolvedValue({ products: [] });
  });

  it("clears tokens and navigates to login", async () => {
    mockGetItemAsync.mockResolvedValue("stored-token");

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));

    await act(async () => {
      await result.current.logout();
    });

    expect(mockDeleteItemAsync).toHaveBeenCalledWith("gumroad_access_token");
    expect(mockDeleteItemAsync).toHaveBeenCalledWith("gumroad_refresh_token");
    expect(result.current.isAuthenticated).toBe(false);
    expect(mockReplace).toHaveBeenCalledWith("/login");
  });
});
