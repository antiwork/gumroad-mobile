import { useState } from "react";

export type SortOption = "content_updated_at" | "purchased_at";

export interface UseLibraryFiltersReturn {
  searchText: string;
  setSearchText: (text: string) => void;
  selectedSellers: Set<string>;
  showArchivedOnly: boolean;
  sortBy: SortOption;
  setSortBy: (sort: SortOption) => void;
  hasActiveFilters: boolean;
  handleSellerToggle: (sellerId: string) => void;
  handleSelectAllSellers: () => void;
  handleClearFilters: () => void;
  handleToggleArchived: () => void;
}

export const useLibraryFilters = (): UseLibraryFiltersReturn => {
  const [searchText, setSearchText] = useState("");
  const [selectedSellers, setSelectedSellers] = useState<Set<string>>(new Set());
  const [showArchivedOnly, setShowArchivedOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("content_updated_at");

  const hasActiveFilters = selectedSellers.size > 0 || showArchivedOnly;

  const handleSellerToggle = (sellerId: string) => {
    setSelectedSellers((prev) => {
      const next = new Set(prev);
      if (next.has(sellerId)) {
        next.delete(sellerId);
      } else {
        next.add(sellerId);
      }
      return next;
    });
  };

  const handleSelectAllSellers = () => {
    setSelectedSellers(new Set());
  };

  const handleClearFilters = () => {
    setSelectedSellers(new Set());
    setShowArchivedOnly(false);
  };

  const handleToggleArchived = () => {
    setShowArchivedOnly((prev) => !prev);
  };

  return {
    searchText,
    setSearchText,
    selectedSellers,
    showArchivedOnly,
    sortBy,
    setSortBy,
    hasActiveFilters,
    handleSellerToggle,
    handleSelectAllSellers,
    handleClearFilters,
    handleToggleArchived,
  };
};
