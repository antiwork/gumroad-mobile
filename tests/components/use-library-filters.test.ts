import { renderHook, act } from "@testing-library/react-native";
import { useLibraryFilters } from "@/components/use-library-filters";

describe("useLibraryFilters", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("apiFilters", () => {
    it("returns default filters", () => {
      const { result } = renderHook(() => useLibraryFilters());
      expect(result.current.apiFilters).toEqual({ order: "date-desc", archived: false });
    });

    it("includes search query after debounce", () => {
      const { result } = renderHook(() => useLibraryFilters());
      act(() => result.current.setSearchText("react"));
      expect(result.current.apiFilters.q).toBeUndefined();
      act(() => jest.advanceTimersByTime(300));
      expect(result.current.apiFilters.q).toBe("react");
    });

    it("trims search text", () => {
      const { result } = renderHook(() => useLibraryFilters());
      act(() => result.current.setSearchText("  react  "));
      act(() => jest.advanceTimersByTime(300));
      expect(result.current.apiFilters.q).toBe("react");
    });

    it("includes selected creators as seller param", () => {
      const { result } = renderHook(() => useLibraryFilters());
      act(() => result.current.handleCreatorToggle("seller-abc"));
      expect(result.current.apiFilters.seller).toEqual(["seller-abc"]);
    });

    it("includes archived flag", () => {
      const { result } = renderHook(() => useLibraryFilters());
      expect(result.current.apiFilters.archived).toBe(false);
      act(() => result.current.handleToggleArchived());
      expect(result.current.apiFilters.archived).toBe(true);
    });

    it("includes sort order", () => {
      const { result } = renderHook(() => useLibraryFilters());
      expect(result.current.apiFilters.order).toBe("date-desc");
      act(() => result.current.setSortBy("date-asc"));
      expect(result.current.apiFilters.order).toBe("date-asc");
    });
  });

  describe("hasActiveFilters", () => {
    it("returns false by default", () => {
      const { result } = renderHook(() => useLibraryFilters());
      expect(result.current.hasActiveFilters).toBe(false);
    });

    it("returns true when a creator is selected", () => {
      const { result } = renderHook(() => useLibraryFilters());
      act(() => result.current.handleCreatorToggle("seller-abc"));
      expect(result.current.hasActiveFilters).toBe(true);
    });

    it("returns true when showArchivedOnly is toggled", () => {
      const { result } = renderHook(() => useLibraryFilters());
      act(() => result.current.handleToggleArchived());
      expect(result.current.hasActiveFilters).toBe(true);
    });
  });

  describe("isSearchPending", () => {
    it("returns true while search text is pending debounce", () => {
      const { result } = renderHook(() => useLibraryFilters());
      act(() => result.current.setSearchText("react"));
      expect(result.current.isSearchPending).toBe(true);
      act(() => jest.advanceTimersByTime(300));
      expect(result.current.isSearchPending).toBe(false);
    });

    it("returns false when search text is empty", () => {
      const { result } = renderHook(() => useLibraryFilters());
      expect(result.current.isSearchPending).toBe(false);
    });
  });

  describe("state handlers", () => {
    it("handleCreatorToggle adds and removes creators", () => {
      const { result } = renderHook(() => useLibraryFilters());
      act(() => result.current.handleCreatorToggle("seller-abc"));
      expect(result.current.selectedCreators.has("seller-abc")).toBe(true);

      act(() => result.current.handleCreatorToggle("seller-abc"));
      expect(result.current.selectedCreators.has("seller-abc")).toBe(false);
    });

    it("handleSelectAllCreators clears selection", () => {
      const { result } = renderHook(() => useLibraryFilters());
      act(() => result.current.handleCreatorToggle("seller-abc"));
      act(() => result.current.handleSelectAllCreators());
      expect(result.current.selectedCreators.size).toBe(0);
    });

    it("handleClearFilters resets creators and archived toggle", () => {
      const { result } = renderHook(() => useLibraryFilters());
      act(() => {
        result.current.handleCreatorToggle("seller-abc");
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
