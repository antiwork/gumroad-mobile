import { useAPIRequest } from "@/lib/request";
import { useEffect, useState } from "react";
import { SalePurchase, type TimeRange } from "./use-sales-analytics";

interface SearchResponse {
  success: boolean;
  formatted_revenue: string;
  sales_count: number;
  purchases: SalePurchase[];
}

export const buildPurchaseSearchPath = (timeRange: TimeRange, endTime: string, searchText: string) =>
  `mobile/analytics/data_by_date.json?range=${timeRange}&end_time=${encodeURIComponent(endTime)}&query=${encodeURIComponent(
    searchText,
  )}`;

export const usePurchaseSearch = (searchText: string, originalPurchases: SalePurchase[], timeRange: TimeRange) => {
  const [debouncedSearchText, setDebouncedSearchText] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchText(searchText.trim());
    }, 500);
    return () => clearTimeout(timer);
  }, [searchText]);

  const endTime = new Date().toISOString();
  const query = useAPIRequest<SearchResponse, SalePurchase[]>({
    queryKey: ["purchaseSearch", timeRange, debouncedSearchText],
    url: buildPurchaseSearchPath(timeRange, endTime, debouncedSearchText),
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
