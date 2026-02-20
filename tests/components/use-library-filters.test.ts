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

    it("has no active filters by default", () => {
      const { result } = renderHook(() => useLibraryFilters());
      expect(result.current.hasActiveFilters).toBe(false);
    });
  });

  describe("searchText", () => {
    it("updates search text", () => {
      const { result } = renderHook(() => useLibraryFilters());
      act(() => result.current.setSearchText("react"));
      expect(result.current.searchText).toBe("react");
    });

    it("clears search text", () => {
      const { result } = renderHook(() => useLibraryFilters());
      act(() => result.current.setSearchText("react"));
      act(() => result.current.setSearchText(""));
      expect(result.current.searchText).toBe("");
    });
  });

  describe("sortBy", () => {
    it("changes sort option", () => {
      const { result } = renderHook(() => useLibraryFilters());
      act(() => result.current.setSortBy("purchased_at"));
      expect(result.current.sortBy).toBe("purchased_at");
    });

    it("switches back to default sort", () => {
      const { result } = renderHook(() => useLibraryFilters());
      act(() => result.current.setSortBy("purchased_at"));
      act(() => result.current.setSortBy("content_updated_at"));
      expect(result.current.sortBy).toBe("content_updated_at");
    });
  });

  describe("handleCreatorToggle", () => {
    it("adds a creator to selection", () => {
      const { result } = renderHook(() => useLibraryFilters());
      act(() => result.current.handleCreatorToggle("seller-1"));
      expect(result.current.selectedCreators.has("seller-1")).toBe(true);
    });

    it("removes a creator when toggled again", () => {
      const { result } = renderHook(() => useLibraryFilters());
      act(() => result.current.handleCreatorToggle("seller-1"));
      act(() => result.current.handleCreatorToggle("seller-1"));
      expect(result.current.selectedCreators.has("seller-1")).toBe(false);
    });

    it("supports multiple selected creators", () => {
      const { result } = renderHook(() => useLibraryFilters());
      act(() => {
        result.current.handleCreatorToggle("seller-1");
        result.current.handleCreatorToggle("seller-2");
      });
      expect(result.current.selectedCreators.size).toBe(2);
      expect(result.current.selectedCreators.has("seller-1")).toBe(true);
      expect(result.current.selectedCreators.has("seller-2")).toBe(true);
    });
  });

  describe("handleSelectAllCreators", () => {
    it("clears all selected creators", () => {
      const { result } = renderHook(() => useLibraryFilters());
      act(() => {
        result.current.handleCreatorToggle("seller-1");
        result.current.handleCreatorToggle("seller-2");
      });
      act(() => result.current.handleSelectAllCreators());
      expect(result.current.selectedCreators.size).toBe(0);
    });
  });

  describe("handleToggleArchived", () => {
    it("toggles archived mode on", () => {
      const { result } = renderHook(() => useLibraryFilters());
      act(() => result.current.handleToggleArchived());
      expect(result.current.showArchivedOnly).toBe(true);
    });

    it("toggles archived mode off", () => {
      const { result } = renderHook(() => useLibraryFilters());
      act(() => result.current.handleToggleArchived());
      act(() => result.current.handleToggleArchived());
      expect(result.current.showArchivedOnly).toBe(false);
    });
  });

  describe("hasActiveFilters", () => {
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

    it("returns true when both filters are active", () => {
      const { result } = renderHook(() => useLibraryFilters());
      act(() => {
        result.current.handleCreatorToggle("seller-1");
        result.current.handleToggleArchived();
      });
      expect(result.current.hasActiveFilters).toBe(true);
    });

    it("returns false after clearing filters", () => {
      const { result } = renderHook(() => useLibraryFilters());
      act(() => {
        result.current.handleCreatorToggle("seller-1");
        result.current.handleToggleArchived();
      });
      act(() => result.current.handleClearFilters());
      expect(result.current.hasActiveFilters).toBe(false);
    });
  });

  describe("handleClearFilters", () => {
    it("resets creators and archived toggle", () => {
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

    it("does not reset search text", () => {
      const { result } = renderHook(() => useLibraryFilters());
      act(() => {
        result.current.setSearchText("test");
        result.current.handleCreatorToggle("seller-1");
      });
      act(() => result.current.handleClearFilters());
      expect(result.current.searchText).toBe("test");
    });

    it("does not reset sort option", () => {
      const { result } = renderHook(() => useLibraryFilters());
      act(() => {
        result.current.setSortBy("purchased_at");
        result.current.handleCreatorToggle("seller-1");
      });
      act(() => result.current.handleClearFilters());
      expect(result.current.sortBy).toBe("purchased_at");
    });
  });
});
