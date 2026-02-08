import { renderHook, act } from "@testing-library/react-native";
import { useLibraryFilters } from "@/components/use-library-filters";
import { Purchase } from "@/app/(tabs)/library";

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

const purchases: Purchase[] = [
  makePurchase({
    name: "Learn React",
    creator_name: "Alice",
    creator_username: "alice",
    content_updated_at: "2024-03-01T00:00:00Z",
    purchased_at: "2024-01-15T00:00:00Z",
  }),
  makePurchase({
    name: "Design Basics",
    creator_name: "Bob",
    creator_username: "bob",
    content_updated_at: "2024-02-01T00:00:00Z",
    purchased_at: "2024-02-20T00:00:00Z",
  }),
  makePurchase({
    name: "Advanced TypeScript",
    creator_name: "Alice",
    creator_username: "alice",
    content_updated_at: "2024-01-01T00:00:00Z",
    purchased_at: "2024-03-10T00:00:00Z",
  }),
  makePurchase({
    name: "Archived Course",
    creator_name: "Charlie",
    creator_username: "charlie",
    is_archived: true,
    content_updated_at: "2024-04-01T00:00:00Z",
    purchased_at: "2024-01-01T00:00:00Z",
  }),
];

describe("useLibraryFilters", () => {
  describe("filtering", () => {
    it("excludes archived products by default", () => {
      const { result } = renderHook(() => useLibraryFilters(purchases));
      expect(result.current.filteredPurchases).toHaveLength(3);
      expect(
        result.current.filteredPurchases.every((p) => !p.is_archived),
      ).toBe(true);
    });

    it("shows only archived products when toggled", () => {
      const { result } = renderHook(() => useLibraryFilters(purchases));
      act(() => result.current.handleToggleArchived());
      expect(result.current.filteredPurchases).toHaveLength(1);
      expect(result.current.filteredPurchases[0].name).toBe("Archived Course");
    });

    it("filters by product name (case-insensitive)", () => {
      const { result } = renderHook(() => useLibraryFilters(purchases));
      act(() => result.current.setSearchText("react"));
      expect(result.current.filteredPurchases).toHaveLength(1);
      expect(result.current.filteredPurchases[0].name).toBe("Learn React");
    });

    it("filters by creator name (case-insensitive)", () => {
      const { result } = renderHook(() => useLibraryFilters(purchases));
      act(() => result.current.setSearchText("BOB"));
      expect(result.current.filteredPurchases).toHaveLength(1);
      expect(result.current.filteredPurchases[0].name).toBe("Design Basics");
    });

    it("filters by selected creator", () => {
      const { result } = renderHook(() => useLibraryFilters(purchases));
      act(() => result.current.handleCreatorToggle("alice"));
      expect(result.current.filteredPurchases).toHaveLength(2);
      expect(
        result.current.filteredPurchases.every(
          (p) => p.creator_username === "alice",
        ),
      ).toBe(true);
    });

    it("combines search and creator filter", () => {
      const { result } = renderHook(() => useLibraryFilters(purchases));
      act(() => {
        result.current.handleCreatorToggle("alice");
        result.current.setSearchText("typescript");
      });
      expect(result.current.filteredPurchases).toHaveLength(1);
      expect(result.current.filteredPurchases[0].name).toBe(
        "Advanced TypeScript",
      );
    });
  });

  describe("sorting", () => {
    it("sorts by content_updated_at descending by default", () => {
      const { result } = renderHook(() => useLibraryFilters(purchases));
      const names = result.current.filteredPurchases.map((p) => p.name);
      expect(names).toEqual([
        "Learn React",
        "Design Basics",
        "Advanced TypeScript",
      ]);
    });

    it("sorts by purchased_at descending", () => {
      const { result } = renderHook(() => useLibraryFilters(purchases));
      act(() => result.current.setSortBy("purchased_at"));
      const names = result.current.filteredPurchases.map((p) => p.name);
      expect(names).toEqual([
        "Advanced TypeScript",
        "Design Basics",
        "Learn React",
      ]);
    });

    it("handles missing dates by pushing them to the end", () => {
      const data = [
        makePurchase({
          name: "No Date",
          creator_username: "x",
          creator_name: "X",
        }),
        makePurchase({
          name: "Has Date",
          creator_username: "y",
          creator_name: "Y",
          content_updated_at: "2024-01-01T00:00:00Z",
        }),
      ];
      const { result } = renderHook(() => useLibraryFilters(data));
      expect(result.current.filteredPurchases[0].name).toBe("Has Date");
      expect(result.current.filteredPurchases[1].name).toBe("No Date");
    });
  });

  describe("creatorCounts", () => {
    it("aggregates by creator username and sorts by count then name", () => {
      const { result } = renderHook(() => useLibraryFilters(purchases));
      expect(result.current.creatorCounts).toEqual([
        { username: "alice", name: "Alice", count: 2 },
        { username: "bob", name: "Bob", count: 1 },
      ]);
    });

    it("only includes archived creators when showArchivedOnly is true", () => {
      const { result } = renderHook(() => useLibraryFilters(purchases));
      act(() => result.current.handleToggleArchived());
      expect(result.current.creatorCounts).toEqual([
        { username: "charlie", name: "Charlie", count: 1 },
      ]);
    });
  });

  describe("hasArchivedProducts", () => {
    it("returns true when archived products exist", () => {
      const { result } = renderHook(() => useLibraryFilters(purchases));
      expect(result.current.hasArchivedProducts).toBe(true);
    });

    it("returns false when no archived products exist", () => {
      const data = [makePurchase({ creator_username: "a", creator_name: "A" })];
      const { result } = renderHook(() => useLibraryFilters(data));
      expect(result.current.hasArchivedProducts).toBe(false);
    });
  });

  describe("hasActiveFilters", () => {
    it("returns false by default", () => {
      const { result } = renderHook(() => useLibraryFilters(purchases));
      expect(result.current.hasActiveFilters).toBe(false);
    });

    it("returns true when a creator is selected", () => {
      const { result } = renderHook(() => useLibraryFilters(purchases));
      act(() => result.current.handleCreatorToggle("alice"));
      expect(result.current.hasActiveFilters).toBe(true);
    });

    it("returns true when showArchivedOnly is toggled", () => {
      const { result } = renderHook(() => useLibraryFilters(purchases));
      act(() => result.current.handleToggleArchived());
      expect(result.current.hasActiveFilters).toBe(true);
    });
  });

  describe("state handlers", () => {
    it("handleCreatorToggle adds and removes creators", () => {
      const { result } = renderHook(() => useLibraryFilters(purchases));
      act(() => result.current.handleCreatorToggle("alice"));
      expect(result.current.selectedCreators.has("alice")).toBe(true);

      act(() => result.current.handleCreatorToggle("alice"));
      expect(result.current.selectedCreators.has("alice")).toBe(false);
    });

    it("handleSelectAllCreators clears selection", () => {
      const { result } = renderHook(() => useLibraryFilters(purchases));
      act(() => result.current.handleCreatorToggle("alice"));
      act(() => result.current.handleSelectAllCreators());
      expect(result.current.selectedCreators.size).toBe(0);
    });

    it("handleClearFilters resets creators and archived toggle", () => {
      const { result } = renderHook(() => useLibraryFilters(purchases));
      act(() => {
        result.current.handleCreatorToggle("alice");
        result.current.handleToggleArchived();
      });
      expect(result.current.hasActiveFilters).toBe(true);

      act(() => result.current.handleClearFilters());
      expect(result.current.selectedCreators.size).toBe(0);
      expect(result.current.showArchivedOnly).toBe(false);
      expect(result.current.hasActiveFilters).toBe(false);
    });
  });
});
