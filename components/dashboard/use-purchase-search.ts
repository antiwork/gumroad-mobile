import { useAPIRequest } from "@/lib/request";
import { useEffect, useState } from "react";
import { SalePurchase } from "./use-sales-analytics";

interface SearchResponse {
  success: boolean;
  formatted_revenue: string;
  sales_count: number;
  purchases: SalePurchase[];
}

export const usePurchaseSearch = (searchText: string, originalPurchases: SalePurchase[]) => {
  const [debouncedSearchText, setDebouncedSearchText] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchText(searchText.trim());
    }, 500);
    return () => clearTimeout(timer);
  }, [searchText]);

  const endTime = new Date().toISOString();
  const query = useAPIRequest<SearchResponse, SalePurchase[]>({
    queryKey: ["purchaseSearch", debouncedSearchText],
    url: `mobile/analytics/data_by_date.json?range=all&end_time=${encodeURIComponent(endTime)}&query=${encodeURIComponent(debouncedSearchText)}`,
    enabled: !!debouncedSearchText,
    select: (data) => data.purchases,
  });

  const isSearching = !!searchText.trim() && (searchText.trim() !== debouncedSearchText || query.isLoading);
  const searchResults = debouncedSearchText ? (query.data ?? []) : originalPurchases;

  return {
    isSearching,
    searchResults,
    error: query.error,
  };
};
