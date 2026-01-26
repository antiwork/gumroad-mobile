import { Purchase } from "@/app/(tabs)/library";
import { useMemo, useState } from "react";

export type SortOption = "content_updated_at" | "purchased_at";

export interface LibraryFiltersState {
  searchText: string;
  selectedCreators: Set<string>;
  showArchivedOnly: boolean;
  sortBy: SortOption;
}

export interface CreatorCount {
  username: string;
  name: string;
  count: number;
}

export interface UseLibraryFiltersReturn {
  searchText: string;
  setSearchText: (text: string) => void;
  selectedCreators: Set<string>;
  showArchivedOnly: boolean;
  sortBy: SortOption;
  setSortBy: (sort: SortOption) => void;
  hasArchivedProducts: boolean;
  hasActiveFilters: boolean;
  creatorCounts: CreatorCount[];
  filteredPurchases: Purchase[];
  handleCreatorToggle: (creatorName: string) => void;
  handleSelectAllCreators: () => void;
  handleClearFilters: () => void;
  handleToggleArchived: () => void;
}

export const useLibraryFilters = (purchases: Purchase[]): UseLibraryFiltersReturn => {
  const [searchText, setSearchText] = useState("");
  const [selectedCreators, setSelectedCreators] = useState<Set<string>>(new Set());
  const [showArchivedOnly, setShowArchivedOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("content_updated_at");

  const hasArchivedProducts = useMemo(() => purchases.some((p) => p.is_archived), [purchases]);

  const creatorCounts = useMemo(() => {
    const basePurchases = showArchivedOnly
      ? purchases.filter((p) => p.is_archived)
      : purchases.filter((p) => !p.is_archived);

    const counts = new Map<string, { name: string; count: number }>();
    for (const purchase of basePurchases) {
      counts.set(purchase.creator_username, {
        name: purchase.creator_name,
        count: (counts.get(purchase.creator_name)?.count ?? 0) + 1,
      });
    }

    return Array.from(counts.entries())
      .sort((a, b) => {
        if (b[1].count !== a[1].count) return b[1].count - a[1].count;
        return a[1].name.localeCompare(b[1].name);
      })
      .map(([username, { name, count }]) => ({ username, name, count }));
  }, [purchases, showArchivedOnly]);

  const filteredPurchases = useMemo(() => {
    let result = showArchivedOnly ? purchases.filter((p) => p.is_archived) : purchases.filter((p) => !p.is_archived);

    if (searchText.trim()) {
      const search = searchText.toLowerCase();
      result = result.filter(
        (p) => p.name.toLowerCase().includes(search) || p.creator_name.toLowerCase().includes(search),
      );
    }

    if (selectedCreators.size > 0) {
      result = result.filter((p) => selectedCreators.has(p.creator_username));
    }

    result = [...result].sort((a, b) => {
      const aDate = sortBy === "content_updated_at" ? a.content_updated_at : a.purchased_at;
      const bDate = sortBy === "content_updated_at" ? b.content_updated_at : b.purchased_at;
      if (!aDate && !bDate) return 0;
      if (!aDate) return 1;
      if (!bDate) return -1;
      return new Date(bDate).getTime() - new Date(aDate).getTime();
    });

    return result;
  }, [purchases, searchText, selectedCreators, showArchivedOnly, sortBy]);

  const hasActiveFilters = selectedCreators.size > 0 || showArchivedOnly;

  const handleCreatorToggle = (username: string) => {
    setSelectedCreators((prev) => {
      const next = new Set(prev);
      if (next.has(username)) {
        next.delete(username);
      } else {
        next.add(username);
      }
      return next;
    });
  };

  const handleSelectAllCreators = () => {
    setSelectedCreators(new Set());
  };

  const handleClearFilters = () => {
    setSelectedCreators(new Set());
    setShowArchivedOnly(false);
  };

  const handleToggleArchived = () => {
    setShowArchivedOnly((prev) => !prev);
  };

  return {
    searchText,
    setSearchText,
    selectedCreators,
    showArchivedOnly,
    sortBy,
    setSortBy,
    hasArchivedProducts,
    hasActiveFilters,
    creatorCounts,
    filteredPurchases,
    handleCreatorToggle,
    handleSelectAllCreators,
    handleClearFilters,
    handleToggleArchived,
  };
};
