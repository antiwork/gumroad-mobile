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

const createWrapper = (retry: number | boolean = false) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry, gcTime: 0, retryDelay: 0 } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  Wrapper.displayName = "TestQueryClientWrapper";
  return Wrapper;
};

const renderUseAPIRequest = (retry: number | boolean = false) =>
  renderHook(() => useAPIRequest<{ ok: boolean }>({ url: "/test", queryKey: ["test"] }), {
    wrapper: createWrapper(retry),
  });

const renderUseAPIRequestWithCallerRetry = (
  callerRetry: number | boolean | ((failureCount: number, error: Error) => boolean),
) =>
  renderHook(
    () =>
      useAPIRequest<{ ok: boolean }>({
        url: "/test",
        queryKey: ["test"],
        retry: callerRetry,
      }),
    { wrapper: createWrapper(false) },
  );

const authHeaderOf = (call: unknown[]): string | undefined => {
  const init = call[1] as RequestInit | undefined;
  const headers = init?.headers as Record<string, string> | undefined;
  return headers?.Authorization;
};

beforeEach(() => {
  mockFetch.mockReset();
  mockRefreshToken.mockReset();
  mockLogout.mockReset();
  (Sentry.captureException as jest.Mock).mockClear();
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

  it("logs out when refresh fails with a raw keychain error (write-side after server rotation)", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}, 401));
    const writeError = new Error("User interaction is not allowed");
    mockRefreshToken.mockRejectedValueOnce(writeError);

    const { result } = renderUseAPIRequest();

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(Sentry.captureException).toHaveBeenCalledWith(
      writeError,
      expect.objectContaining({ tags: { auth_path: "refresh_failed" } }),
    );
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
      .mockResolvedValue(jsonResponse({ error: "boom" }, 503));
    mockRefreshToken.mockResolvedValueOnce("fresh-token");

    const { result } = renderUseAPIRequest();

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toMatch(/503/);
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it("under production retry:2, a scope-stuck 401 triggers refresh exactly once (no extra rotations)", async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({}, 401))
      .mockResolvedValueOnce(jsonResponse({}, 401))
      .mockResolvedValue(jsonResponse({}, 401));
    mockRefreshToken.mockResolvedValue("fresh-token");

    const { result } = renderUseAPIRequest(2);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(UnauthorizedError);
    expect(mockRefreshToken).toHaveBeenCalledTimes(1);
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it("under production retry:2, a transient 5xx still retries (auth-only opt-out)", async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ error: "boom" }, 500))
      .mockResolvedValueOnce(jsonResponse({ error: "boom" }, 500))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    const { result } = renderUseAPIRequest(2);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(mockRefreshToken).not.toHaveBeenCalled();
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it("under production retry:2, a KeychainUnavailableError path does not retry-loop on a locked keychain", async () => {
    mockFetch.mockResolvedValue(jsonResponse({}, 401));
    mockRefreshToken.mockRejectedValue(new KeychainUnavailableError());

    const { result } = renderUseAPIRequest(2);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(UnauthorizedError);
    expect(mockRefreshToken).toHaveBeenCalledTimes(1);
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it("does not attempt refresh for non-UnauthorizedError failures", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ error: "boom" }, 500));

    const { result } = renderUseAPIRequest();

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockRefreshToken).not.toHaveBeenCalled();
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it("ignores a caller-supplied retry:true for UnauthorizedError (auth opt-out wins)", async () => {
    mockFetch.mockResolvedValue(jsonResponse({}, 401));
    mockRefreshToken.mockResolvedValue("fresh-token");

    const { result } = renderUseAPIRequestWithCallerRetry(true);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockRefreshToken).toHaveBeenCalledTimes(1);
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it("ignores a caller-supplied retry:5 for UnauthorizedError (auth opt-out wins)", async () => {
    mockFetch.mockResolvedValue(jsonResponse({}, 401));
    mockRefreshToken.mockResolvedValue("fresh-token");

    const { result } = renderUseAPIRequestWithCallerRetry(5);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockRefreshToken).toHaveBeenCalledTimes(1);
  });

  it("does not retry AbortError even with retry:2", async () => {
    const abortError = new DOMException("The operation was aborted.", "AbortError");
    mockFetch.mockRejectedValue(abortError);

    const { result } = renderUseAPIRequest(2);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.name).toBe("AbortError");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("ignores a caller-supplied retry function for UnauthorizedError but consults it for other errors", async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ error: "boom" }, 500))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    const callerRetry = jest.fn<boolean, [number, Error]>(() => true);

    const { result } = renderUseAPIRequestWithCallerRetry(callerRetry);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(callerRetry).toHaveBeenCalled();
    const errorArg = callerRetry.mock.calls[0]?.[1];
    expect(errorArg?.message).toMatch(/500/);
  });
});
