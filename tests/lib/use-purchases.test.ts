import { renderHook, waitFor } from "@testing-library/react-native";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

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
  useAuth: () => ({
    accessToken: "test-token",
    logout: mockLogout,
    isLoading: false,
  }),
}));

jest.mock("@/lib/assert", () => ({
  assertDefined: <T>(value: T) => value,
}));

import { usePurchases, usePurchase, Purchase } from "@/lib/use-purchases";

const makePurchase = (overrides: Partial<Purchase> = {}): Purchase => ({
  name: "Test Product",
  creator_name: "Test Creator",
  creator_username: "testcreator",
  creator_profile_picture_url: "https://example.com/pic.jpg",
  thumbnail_url: null,
  url_redirect_token: "token123",
  purchase_email: "test@example.com",
  ...overrides,
});

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

describe("usePurchases", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("fetches the first page of purchases", async () => {
    const products = [makePurchase({ url_redirect_token: "a" })];
    mockRequestAPI.mockResolvedValue({ success: true, products, user_id: "u1" });

    const { result } = renderHook(() => usePurchases(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.data).toHaveLength(1);
    expect(mockRequestAPI).toHaveBeenCalledWith(
      expect.stringContaining("per_page=24&page=1"),
      expect.objectContaining({ accessToken: "test-token" }),
    );
  });

  it("has next page when a full page is returned", async () => {
    const products = Array.from({ length: 24 }, (_, i) =>
      makePurchase({ url_redirect_token: `token-${i}` }),
    );
    mockRequestAPI.mockResolvedValue({ success: true, products, user_id: "u1" });

    const { result } = renderHook(() => usePurchases(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.hasNextPage).toBe(true);
  });

  it("has no next page when a partial page is returned", async () => {
    const products = [makePurchase({ url_redirect_token: "a" })];
    mockRequestAPI.mockResolvedValue({ success: true, products, user_id: "u1" });

    const { result } = renderHook(() => usePurchases(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.hasNextPage).toBe(false);
  });

  it("flattens multiple pages into a single array", async () => {
    const page1 = Array.from({ length: 24 }, (_, i) =>
      makePurchase({ url_redirect_token: `p1-${i}`, name: `Product ${i}` }),
    );
    const page2 = [makePurchase({ url_redirect_token: "p2-0", name: "Last Product" })];

    mockRequestAPI
      .mockResolvedValueOnce({ success: true, products: page1, user_id: "u1" })
      .mockResolvedValueOnce({ success: true, products: page2, user_id: "u1" });

    const { result } = renderHook(() => usePurchases(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.data).toHaveLength(24));

    await result.current.fetchNextPage();
    await waitFor(() => expect(result.current.data).toHaveLength(25));

    expect(result.current.data![24].name).toBe("Last Product");
  });
});

describe("usePurchase", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns the purchase matching the given id", async () => {
    const products = [
      makePurchase({ url_redirect_token: "aaa", name: "First" }),
      makePurchase({ url_redirect_token: "bbb", name: "Second" }),
    ];
    mockRequestAPI.mockResolvedValue({ success: true, products, user_id: "u1" });

    const { result } = renderHook(() => usePurchase("bbb"), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current).toBeDefined());

    expect(result.current?.name).toBe("Second");
  });
});
