import { renderHook, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

const mockRequestAPI = jest.fn();
jest.mock("@/lib/request", () => ({
  requestAPI: (...args: unknown[]) => mockRequestAPI(...args),
  UnauthorizedError: class extends Error {
    constructor(message: string) {
      super(message);
      this.name = "UnauthorizedError";
    }
  },
}));

const mockLogout = jest.fn();
jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ accessToken: "test-token", logout: mockLogout, isLoading: false }),
}));

jest.mock("@/lib/assert", () => ({
  assertDefined: <T>(value: T) => value,
}));

import { usePurchases, usePurchase } from "@/lib/use-purchases";

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

const makeSearchResponse = (
  purchases: { name: string; url_redirect_token: string }[],
  options: { next?: number | null; count?: number; sellers?: { id: string; name: string; purchases_count: number }[] } = {},
) => ({
  success: true,
  user_id: "user-1",
  purchases: purchases.map((p) => ({
    creator_name: "Creator",
    creator_username: "creator",
    creator_profile_picture_url: "https://example.com/pic.jpg",
    thumbnail_url: null,
    purchase_email: "test@example.com",
    ...p,
  })),
  sellers: options.sellers ?? [],
  meta: {
    pagination: {
      count: options.count ?? purchases.length,
      items: 24,
      page: 1,
      pages: 1,
      prev: null,
      next: options.next ?? null,
      last: 1,
    },
  },
});

describe("usePurchases", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("fetches from the search endpoint", async () => {
    mockRequestAPI.mockResolvedValue(makeSearchResponse([{ name: "Product 1", url_redirect_token: "tok1" }]));
    const { result } = renderHook(() => usePurchases(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.purchases).toHaveLength(1));

    expect(mockRequestAPI).toHaveBeenCalledWith(
      expect.stringContaining("mobile/purchases/search"),
      expect.objectContaining({ accessToken: "test-token" }),
    );
  });

  it("passes filter params to the API", async () => {
    mockRequestAPI.mockResolvedValue(makeSearchResponse([]));
    const filters = { q: "test", seller: ["abc"], archived: true as const, order: "date-asc" as const };
    const { result } = renderHook(() => usePurchases(filters), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const url = mockRequestAPI.mock.calls[0][0] as string;
    expect(url).toContain("q=test");
    expect(url).toContain("seller%5B%5D=abc");
    expect(url).toContain("archived=true");
    expect(url).toContain("order=date-asc");
  });

  it("uses meta.pagination.next for next page detection", async () => {
    mockRequestAPI.mockResolvedValue(
      makeSearchResponse([{ name: "P1", url_redirect_token: "t1" }], { next: 2, count: 48 }),
    );
    const { result } = renderHook(() => usePurchases(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
  });

  it("has no next page when pagination.next is null", async () => {
    mockRequestAPI.mockResolvedValue(
      makeSearchResponse([{ name: "P1", url_redirect_token: "t1" }], { next: null }),
    );
    const { result } = renderHook(() => usePurchases(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.purchases).toHaveLength(1));
    expect(result.current.hasNextPage).toBe(false);
  });

  it("exposes sellers from the response", async () => {
    const sellers = [
      { id: "s1", name: "Alice", purchases_count: 3 },
      { id: "s2", name: "Bob", purchases_count: 1 },
    ];
    mockRequestAPI.mockResolvedValue(
      makeSearchResponse([{ name: "P1", url_redirect_token: "t1" }], { sellers }),
    );
    const { result } = renderHook(() => usePurchases(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.sellers).toHaveLength(2));
    expect(result.current.sellers).toEqual(sellers);
  });

  it("exposes totalCount from pagination metadata", async () => {
    mockRequestAPI.mockResolvedValue(
      makeSearchResponse([{ name: "P1", url_redirect_token: "t1" }], { count: 42 }),
    );
    const { result } = renderHook(() => usePurchases(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.totalCount).toBe(42));
  });
});

describe("usePurchase", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("finds a purchase from the cached query data", async () => {
    mockRequestAPI.mockResolvedValue(
      makeSearchResponse([
        { name: "Product A", url_redirect_token: "tok-a" },
        { name: "Product B", url_redirect_token: "tok-b" },
      ]),
    );
    const wrapper = createWrapper();
    const { result: purchasesResult } = renderHook(() => usePurchases(), { wrapper });
    await waitFor(() => expect(purchasesResult.current.purchases).toHaveLength(2));

    const { result } = renderHook(() => usePurchase("tok-b"), { wrapper });
    expect(result.current?.name).toBe("Product B");
  });

  it("returns undefined when purchase is not in cache", () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => usePurchase("nonexistent"), { wrapper });
    expect(result.current).toBeUndefined();
  });
});
