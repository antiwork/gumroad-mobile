import { renderHook, act } from "@testing-library/react-native";
import { useLibraryFilters } from "@/components/use-library-filters";

describe("useLibraryFilters", () => {
  describe("initial state", () => {
    it("has empty search text", () => {
      const { result } = renderHook(() => useLibraryFilters());
      expect(result.current.searchText).toBe("");
    });

    it("has no selected creators", () => {
      const { result } = renderHook(() => useLibraryFilters());
      expect(result.current.selectedCreators.size).toBe(0);
    });

    it("does not show archived only by default", () => {
      const { result } = renderHook(() => useLibraryFilters());
      expect(result.current.showArchivedOnly).toBe(false);
    });

    it("sorts by content_updated_at by default", () => {
      const { result } = renderHook(() => useLibraryFilters());
      expect(result.current.sortBy).toBe("content_updated_at");
    });
  });

  describe("hasActiveFilters", () => {
    it("returns false by default", () => {
      const { result } = renderHook(() => useLibraryFilters());
      expect(result.current.hasActiveFilters).toBe(false);
    });

    it("returns true when a creator is selected", () => {
      const { result } = renderHook(() => useLibraryFilters());
      act(() => result.current.handleCreatorToggle("seller-1"));
      expect(result.current.hasActiveFilters).toBe(true);
    });

    it("returns true when showArchivedOnly is toggled", () => {
      const { result } = renderHook(() => useLibraryFilters());
      act(() => result.current.handleToggleArchived());
      expect(result.current.hasActiveFilters).toBe(true);
    });
  });

  describe("state handlers", () => {
    it("handleCreatorToggle adds and removes creators", () => {
      const { result } = renderHook(() => useLibraryFilters());
      act(() => result.current.handleCreatorToggle("seller-1"));
      expect(result.current.selectedCreators.has("seller-1")).toBe(true);

      act(() => result.current.handleCreatorToggle("seller-1"));
      expect(result.current.selectedCreators.has("seller-1")).toBe(false);
    });

    it("handleSelectAllCreators clears selection", () => {
      const { result } = renderHook(() => useLibraryFilters());
      act(() => result.current.handleCreatorToggle("seller-1"));
      act(() => result.current.handleSelectAllCreators());
      expect(result.current.selectedCreators.size).toBe(0);
    });

    it("handleClearFilters resets creators and archived toggle", () => {
      const { result } = renderHook(() => useLibraryFilters());
      act(() => {
        result.current.handleCreatorToggle("seller-1");
        result.current.handleToggleArchived();
      });
      expect(result.current.hasActiveFilters).toBe(true);

      act(() => result.current.handleClearFilters());
      expect(result.current.selectedCreators.size).toBe(0);
      expect(result.current.showArchivedOnly).toBe(false);
      expect(result.current.hasActiveFilters).toBe(false);
    });

    it("setSearchText updates search text", () => {
      const { result } = renderHook(() => useLibraryFilters());
      act(() => result.current.setSearchText("react"));
      expect(result.current.searchText).toBe("react");
    });

    it("setSortBy updates sort option", () => {
      const { result } = renderHook(() => useLibraryFilters());
      act(() => result.current.setSortBy("purchased_at"));
      expect(result.current.sortBy).toBe("purchased_at");
    });

    it("handleToggleArchived toggles archived state", () => {
      const { result } = renderHook(() => useLibraryFilters());
      expect(result.current.showArchivedOnly).toBe(false);
      act(() => result.current.handleToggleArchived());
      expect(result.current.showArchivedOnly).toBe(true);
      act(() => result.current.handleToggleArchived());
      expect(result.current.showArchivedOnly).toBe(false);
    });
  });
});
