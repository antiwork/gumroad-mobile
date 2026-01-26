import { assertDefined } from "@/lib/assert";
import { useAuth } from "@/lib/auth-context";
import { requestAPI, UnauthorizedError } from "@/lib/request";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { SalePurchase } from "./use-sales-analytics";

interface SearchResponse {
  success: boolean;
  formatted_revenue: string;
  sales_count: number;
  purchases: SalePurchase[];
}

export const usePurchaseSearch = (searchText: string, originalPurchases: SalePurchase[]) => {
  const { accessToken, logout, isLoading: isAuthLoading } = useAuth();
  const [debouncedSearchText, setDebouncedSearchText] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchText(searchText.trim());
    }, 500);
    return () => clearTimeout(timer);
  }, [searchText]);

  const query = useQuery({
    queryKey: ["purchaseSearch", debouncedSearchText],
    queryFn: async () => {
      const endTime = new Date().toISOString();
      const response = await requestAPI<SearchResponse>(
        `mobile/analytics/data_by_date.json?range=all&end_time=${encodeURIComponent(endTime)}&query=${encodeURIComponent(debouncedSearchText)}`,
        { accessToken: assertDefined(accessToken) },
      );
      return response.purchases;
    },
    enabled: !!accessToken && !!debouncedSearchText,
  });

  useEffect(() => {
    if ((!isAuthLoading && !accessToken) || query.error instanceof UnauthorizedError) logout();
  }, [isAuthLoading, accessToken, query.error, logout]);

  const isSearching = !!searchText.trim() && (searchText.trim() !== debouncedSearchText || query.isLoading);
  const searchResults = debouncedSearchText ? (query.data ?? []) : originalPurchases;

  return {
    isSearching,
    searchResults,
    error: query.error,
  };
};
