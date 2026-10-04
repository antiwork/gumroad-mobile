import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react-native";
import React from "react";

import { useRecentPurchases } from "@/components/library/use-recent-products";

const mockRequestAPI = jest.fn();
jest.mock("@/lib/request", () => ({
  requestAPI: (...args: unknown[]) => mockRequestAPI(...args),
}));

jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ accessToken: "test-token" }),
}));

jest.mock("@/lib/assert", () => ({
  assertDefined: <T>(value: T) => value,
}));

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn().mockResolvedValue(JSON.stringify(["purchase-1"])),
  setItemAsync: jest.fn(),
}));

const createRetryingWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: 0, retry: 2, retryDelay: 1 } } });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  return Wrapper;
};

const unconfirmedError = () =>
  Object.assign(new Error("Request failed: 403 Access denied"), {
    name: "RequestError",
    statusCode: 403,
    serverMessage: "Please confirm your email address before you can see your purchases.",
  });

describe("useRecentPurchases", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does not retry the unconfirmed-email 403", async () => {
    mockRequestAPI.mockRejectedValue(unconfirmedError());
    const { result } = renderHook(() => useRecentPurchases(), { wrapper: createRetryingWrapper() });

    await waitFor(() => expect(mockRequestAPI).toHaveBeenCalled());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockRequestAPI).toHaveBeenCalledTimes(1);
  });

  it("still retries other failures", async () => {
    mockRequestAPI.mockRejectedValue(new Error("Aborted"));
    const { result } = renderHook(() => useRecentPurchases(), { wrapper: createRetryingWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await waitFor(() => expect(mockRequestAPI).toHaveBeenCalledTimes(3));
  });
});
