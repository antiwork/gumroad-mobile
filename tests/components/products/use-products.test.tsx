/* eslint-disable import/first -- jest.mock must precede imports */
import { renderHook, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";

const mockRequestAPI = jest.fn();
const mockRefreshToken = jest.fn();
const mockLogout = jest.fn();

jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    accessToken: "token",
    refreshToken: mockRefreshToken,
    logout: mockLogout,
    isLoading: false,
  }),
}));

jest.mock("@/lib/request", () => ({
  requestAPI: (...args: unknown[]) => mockRequestAPI(...args),
  UnauthorizedError: class UnauthorizedError extends Error {},
  KeychainUnavailableError: class KeychainUnavailableError extends Error {},
  SessionExpiredError: class SessionExpiredError extends Error {},
}));

jest.mock("@sentry/react-native", () => ({
  captureException: jest.fn(),
}));

import { useDeleteProduct, useProducts } from "@/components/products/use-products";
import { KeychainUnavailableError, UnauthorizedError } from "@/lib/request";

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

const noRetryWrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

const productsPage = {
  success: true,
  products: [{ id: "abc", name: "Guide", permalink: "abc", price_formatted: "$10", status: "published" }],
  pagination: { count: 1, page: 1, pages: 1, next: null },
};

describe("useProducts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("loads the first page of products", async () => {
    mockRequestAPI.mockResolvedValue(productsPage);

    const { result } = renderHook(() => useProducts(), { wrapper });

    await waitFor(() => expect(result.current.products).toHaveLength(1));
    expect(mockRequestAPI).toHaveBeenCalledWith("mobile/products.json?page=1", { accessToken: "token" });
    expect(result.current.products[0]?.name).toBe("Guide");
  });

  it("refreshes an expired access token and retries instead of logging out", async () => {
    mockRequestAPI.mockRejectedValueOnce(new UnauthorizedError("expired")).mockResolvedValueOnce(productsPage);
    mockRefreshToken.mockResolvedValue("fresh-token");

    const { result } = renderHook(() => useProducts(), { wrapper });

    await waitFor(() => expect(result.current.products).toHaveLength(1));
    expect(mockRefreshToken).toHaveBeenCalledTimes(1);
    expect(mockRequestAPI).toHaveBeenLastCalledWith("mobile/products.json?page=1", { accessToken: "fresh-token" });
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it("keeps the session when the keychain is temporarily locked during refresh", async () => {
    mockRequestAPI.mockRejectedValue(new UnauthorizedError("expired"));
    mockRefreshToken.mockRejectedValue(new KeychainUnavailableError());

    const { result } = renderHook(() => useProducts(), { wrapper: noRetryWrapper });

    await waitFor(() => expect(result.current.error).toBeInstanceOf(UnauthorizedError));
    expect(mockLogout).not.toHaveBeenCalled();
  });
});

describe("useDeleteProduct", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("refreshes an expired access token and retries the deletion", async () => {
    mockRequestAPI.mockRejectedValueOnce(new UnauthorizedError("expired")).mockResolvedValueOnce({ success: true });
    mockRefreshToken.mockResolvedValue("fresh-token");

    const { result } = renderHook(() => useDeleteProduct(), { wrapper });

    await result.current.mutateAsync("abc");
    expect(mockRefreshToken).toHaveBeenCalledTimes(1);
    expect(mockRequestAPI).toHaveBeenLastCalledWith("mobile/products/abc", {
      method: "DELETE",
      accessToken: "fresh-token",
    });
    expect(mockLogout).not.toHaveBeenCalled();
  });
});
