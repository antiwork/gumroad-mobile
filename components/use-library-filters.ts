import { ApiFilters } from "@/lib/use-purchases";
import { useEffect, useMemo, useState } from "react";

export type SortOption = "date-desc" | "date-asc";

export interface UseLibraryFiltersReturn {
  searchText: string;
  setSearchText: (text: string) => void;
  selectedCreators: Set<string>;
  showArchivedOnly: boolean;
  sortBy: SortOption;
  setSortBy: (sort: SortOption) => void;
  hasActiveFilters: boolean;
  apiFilters: ApiFilters;
  handleCreatorToggle: (creatorId: string) => void;
  handleSelectAllCreators: () => void;
  handleClearFilters: () => void;
  handleToggleArchived: () => void;
}

export const useLibraryFilters = (): UseLibraryFiltersReturn => {
  const [searchText, setSearchText] = useState("");
  const [debouncedSearchText, setDebouncedSearchText] = useState("");
  const [selectedCreators, setSelectedCreators] = useState<Set<string>>(new Set());
  const [showArchivedOnly, setShowArchivedOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("date-desc");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchText(searchText.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  const apiFilters = useMemo((): ApiFilters => {
    const filters: ApiFilters = { order: sortBy };
    if (debouncedSearchText) filters.q = debouncedSearchText;
    if (selectedCreators.size > 0) filters.seller = Array.from(selectedCreators);
    filters.archived = showArchivedOnly;
    return filters;
  }, [debouncedSearchText, selectedCreators, showArchivedOnly, sortBy]);

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
    apiFilters,
    handleCreatorToggle,
    handleSelectAllCreators,
    handleClearFilters,
    handleToggleArchived,
  };
};
