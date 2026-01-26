import { assertDefined } from "@/lib/assert";
import { useAuth } from "@/lib/auth-context";
import { requestAPI, UnauthorizedError } from "@/lib/request";
import { useEffect, useRef, useState } from "react";
import { SalePurchase } from "./use-sales-analytics";

interface SearchResponse {
  success: boolean;
  formatted_revenue: string;
  sales_count: number;
  purchases: SalePurchase[];
}

export const usePurchaseSearch = (searchText: string, originalPurchases: SalePurchase[]) => {
  const { accessToken, logout, isLoading: isAuthLoading } = useAuth();
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SalePurchase[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!searchText.trim()) {
      setSearchResults(originalPurchases);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const endTime = new Date().toISOString();
        const response = await requestAPI<SearchResponse>(
          `mobile/analytics/data_by_date.json?range=all&end_time=${encodeURIComponent(endTime)}&query=${encodeURIComponent(searchText.trim())}`,
          { accessToken: assertDefined(accessToken) },
        );
        setSearchResults(response.purchases);
        setError(null);
      } catch (err) {
        if (err instanceof UnauthorizedError) {
          logout();
        } else {
          setError(err instanceof Error ? err : new Error("Search failed"));
        }
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchText, accessToken, logout, originalPurchases]);

  useEffect(() => {
    if (!isAuthLoading && !accessToken) {
      logout();
    }
  }, [isAuthLoading, accessToken, logout]);

  useEffect(() => {
    if (!searchText.trim()) {
      setSearchResults(originalPurchases);
    }
  }, [originalPurchases, searchText]);

  return {
    isSearching,
    searchResults,
    error,
  };
};
