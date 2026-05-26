import * as Sentry from "@sentry/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react-native";
import React from "react";

import { KeychainUnavailableError, UnauthorizedError, useAPIRequest } from "@/lib/request";

const mockRefreshToken = jest.fn();
const mockLogout = jest.fn();
jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    accessToken: "stale-token",
    refreshToken: mockRefreshToken,
    logout: mockLogout,
  }),
}));

jest.mock("@/lib/assert", () => ({
  assertDefined: <T,>(value: T) => value,
}));

jest.mock("@/lib/env", () => ({
  env: {
    EXPO_PUBLIC_MOBILE_TOKEN: "test-mobile-token",
    EXPO_PUBLIC_GUMROAD_API_URL: "https://api.example.com",
  },
}));

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const jsonResponse = (data: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(data),
  text: () => Promise.resolve(JSON.stringify(data)),
});

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  Wrapper.displayName = "TestQueryClientWrapper";
  return Wrapper;
};

const renderUseAPIRequest = () =>
  renderHook(() => useAPIRequest<{ ok: boolean }>({ url: "/test", queryKey: ["test"] }), {
    wrapper: createWrapper(),
  });

const authHeaderOf = (call: unknown[]): string | undefined => {
  const init = call[1] as RequestInit | undefined;
  const headers = init?.headers as Record<string, string> | undefined;
  return headers?.Authorization;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("useAPIRequest", () => {
  it("returns data on a successful request without invoking refresh or logout", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));

    const { result } = renderUseAPIRequest();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ ok: true });
    expect(mockRefreshToken).not.toHaveBeenCalled();
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it("attempts refresh on 401 and retries with the new token", async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({}, 401))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    mockRefreshToken.mockResolvedValueOnce("fresh-token");

    const { result } = renderUseAPIRequest();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockRefreshToken).toHaveBeenCalledTimes(1);
    expect(authHeaderOf(mockFetch.mock.calls[0])).toBe("Bearer stale-token");
    expect(authHeaderOf(mockFetch.mock.calls[1])).toBe("Bearer fresh-token");
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it("propagates the original 401 without logging out when refresh fails with KeychainUnavailableError", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}, 401));
    mockRefreshToken.mockRejectedValueOnce(new KeychainUnavailableError());

    const { result } = renderUseAPIRequest();

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(UnauthorizedError);
    expect(mockLogout).not.toHaveBeenCalled();
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("logs out and reports to Sentry with auth_path tag when refresh fails with a non-keychain error", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}, 401));
    const refreshError = new Error("invalid_grant");
    mockRefreshToken.mockRejectedValueOnce(refreshError);

    const { result } = renderUseAPIRequest();

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(Sentry.captureException).toHaveBeenCalledWith(
      refreshError,
      expect.objectContaining({ tags: { auth_path: "refresh_failed" } }),
    );
    expect(result.current.error).toBeInstanceOf(UnauthorizedError);
  });

  it("propagates a retry 401 without logging out (scope-stuck path)", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}, 401)).mockResolvedValueOnce(jsonResponse({}, 401));
    mockRefreshToken.mockResolvedValueOnce("fresh-token");

    const { result } = renderUseAPIRequest();

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(UnauthorizedError);
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it("propagates a transient 5xx on retry without logging out", async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({}, 401))
      .mockResolvedValueOnce(jsonResponse({ error: "boom" }, 503));
    mockRefreshToken.mockResolvedValueOnce("fresh-token");

    const { result } = renderUseAPIRequest();

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toMatch(/503/);
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it("does not attempt refresh for non-UnauthorizedError failures", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ error: "boom" }, 500));

    const { result } = renderUseAPIRequest();

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockRefreshToken).not.toHaveBeenCalled();
    expect(mockLogout).not.toHaveBeenCalled();
  });
});
