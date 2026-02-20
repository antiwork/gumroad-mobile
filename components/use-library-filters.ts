import { useState } from "react";

export type SortOption = "content_updated_at" | "purchased_at";

export interface LibraryFiltersState {
  searchText: string;
  selectedCreators: Set<string>;
  showArchivedOnly: boolean;
  sortBy: SortOption;
}

export interface UseLibraryFiltersReturn {
  searchText: string;
  setSearchText: (text: string) => void;
  selectedCreators: Set<string>;
  showArchivedOnly: boolean;
  sortBy: SortOption;
  setSortBy: (sort: SortOption) => void;
  hasActiveFilters: boolean;
  handleCreatorToggle: (creatorId: string) => void;
  handleSelectAllCreators: () => void;
  handleClearFilters: () => void;
  handleToggleArchived: () => void;
}

export const useLibraryFilters = (): UseLibraryFiltersReturn => {
  const [searchText, setSearchText] = useState("");
  const [selectedCreators, setSelectedCreators] = useState<Set<string>>(new Set());
  const [showArchivedOnly, setShowArchivedOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("content_updated_at");

  const hasActiveFilters = selectedCreators.size > 0 || showArchivedOnly;

  const handleCreatorToggle = (creatorId: string) => {
    setSelectedCreators((prev) => {
      const next = new Set(prev);
      if (next.has(creatorId)) {
        next.delete(creatorId);
      } else {
        next.add(creatorId);
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
    hasActiveFilters,
    handleCreatorToggle,
    handleSelectAllCreators,
    handleClearFilters,
    handleToggleArchived,
  };
};
