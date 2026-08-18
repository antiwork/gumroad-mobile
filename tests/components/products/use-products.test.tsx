import { renderHook, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";

const mockRequestAPI = jest.fn();
const mockLogout = jest.fn();

jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    accessToken: "token",
    logout: mockLogout,
    isLoading: false,
  }),
}));

jest.mock("@/lib/request", () => ({
  requestAPI: (...args: unknown[]) => mockRequestAPI(...args),
  UnauthorizedError: class UnauthorizedError extends Error {},
}));

import { useProducts } from "@/components/products/use-products";

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

describe("useProducts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("loads the first page of products", async () => {
    mockRequestAPI.mockResolvedValue({
      success: true,
      products: [{ id: "abc", name: "Guide", permalink: "abc", price_formatted: "$10", status: "published" }],
      pagination: { count: 1, page: 1, pages: 1, next: null },
    });

    const { result } = renderHook(() => useProducts(), { wrapper });

    await waitFor(() => expect(result.current.products).toHaveLength(1));
    expect(mockRequestAPI).toHaveBeenCalledWith("mobile/products.json?page=1", { accessToken: "token" });
    expect(result.current.products[0]?.name).toBe("Guide");
  });
});
