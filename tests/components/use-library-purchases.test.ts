import { useLibraryPurchases } from "@/components/use-library-purchases";
import { act, renderHook } from "@testing-library/react-native";

jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    accessToken: "test-token",
    logout: jest.fn(),
    isLoading: false,
  }),
}));

jest.mock("@/lib/request", () => ({
  requestAPI: jest.fn(),
  UnauthorizedError: class extends Error {
    constructor(message: string) {
      super(message);
      this.name = "UnauthorizedError";
    }
  },
}));

jest.mock("@tanstack/react-query", () => {
  const actual = jest.requireActual("@tanstack/react-query");
  return {
    ...actual,
    useInfiniteQuery: jest.fn(() => ({
      data: undefined,
      isLoading: true,
      isRefetching: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      error: null,
      refetch: jest.fn(),
      fetchNextPage: jest.fn(),
    })),
    useQuery: jest.fn(() => ({
      data: [],
      isLoading: false,
      error: null,
    })),
  };
});

describe("useLibraryPurchases", () => {
  describe("state handlers", () => {
    it("starts with empty search query", () => {
      const { result } = renderHook(() => useLibraryPurchases());
      expect(result.current.searchQuery).toBe("");
    });

    it("starts with content_updated_at sort", () => {
      const { result } = renderHook(() => useLibraryPurchases());
      expect(result.current.sortBy).toBe("content_updated_at");
    });

    it("starts with no active filters", () => {
      const { result } = renderHook(() => useLibraryPurchases());
      expect(result.current.hasActiveFilters).toBe(false);
    });

    it("starts with showArchivedOnly as false", () => {
      const { result } = renderHook(() => useLibraryPurchases());
      expect(result.current.showArchivedOnly).toBe(false);
    });

    it("handleSellerToggle adds and removes sellers", () => {
      const { result } = renderHook(() => useLibraryPurchases());
      act(() => result.current.handleSellerToggle("seller-1"));
      expect(result.current.selectedSellers.has("seller-1")).toBe(true);
      expect(result.current.hasActiveFilters).toBe(true);

      act(() => result.current.handleSellerToggle("seller-1"));
      expect(result.current.selectedSellers.has("seller-1")).toBe(false);
    });

    it("handleSelectAllSellers clears selection", () => {
      const { result } = renderHook(() => useLibraryPurchases());
      act(() => result.current.handleSellerToggle("seller-1"));
      act(() => result.current.handleSelectAllSellers());
      expect(result.current.selectedSellers.size).toBe(0);
    });

    it("handleClearFilters resets sellers and archived toggle", () => {
      const { result } = renderHook(() => useLibraryPurchases());
      act(() => {
        result.current.handleSellerToggle("seller-1");
        result.current.handleToggleArchived();
      });
      expect(result.current.hasActiveFilters).toBe(true);

      act(() => result.current.handleClearFilters());
      expect(result.current.selectedSellers.size).toBe(0);
      expect(result.current.showArchivedOnly).toBe(false);
      expect(result.current.hasActiveFilters).toBe(false);
    });

    it("handleToggleArchived toggles the archived state", () => {
      const { result } = renderHook(() => useLibraryPurchases());
      expect(result.current.showArchivedOnly).toBe(false);

      act(() => result.current.handleToggleArchived());
      expect(result.current.showArchivedOnly).toBe(true);
      expect(result.current.hasActiveFilters).toBe(true);

      act(() => result.current.handleToggleArchived());
      expect(result.current.showArchivedOnly).toBe(false);
    });

    it("setSortBy changes the sort option", () => {
      const { result } = renderHook(() => useLibraryPurchases());
      act(() => result.current.setSortBy("purchased_at"));
      expect(result.current.sortBy).toBe("purchased_at");
    });

    it("setSearchQuery updates the search text", () => {
      const { result } = renderHook(() => useLibraryPurchases());
      act(() => result.current.setSearchQuery("test search"));
      expect(result.current.searchQuery).toBe("test search");
    });
  });
});
