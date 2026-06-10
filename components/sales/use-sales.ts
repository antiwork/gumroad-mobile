import { SalePurchase } from "@/components/dashboard/use-sales-analytics";
import { assertDefined } from "@/lib/assert";
import { useAuth } from "@/lib/auth-context";
import { requestAPI } from "@/lib/request";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

interface SalesResponse {
  success: boolean;
  purchases: SalePurchase[];
  pagination: {
    count: number;
    page: number;
    pages: number;
    next: number | null;
  };
}

export const buildSalesPath = (page: number, query: string) =>
  `mobile/sales.json?page=${page}${query ? `&query=${encodeURIComponent(query)}` : ""}`;

export const useSales = (searchText: string, enabled = true) => {
  const { accessToken } = useAuth();
  const [debouncedSearchText, setDebouncedSearchText] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchText(searchText.trim());
    }, 500);
    return () => clearTimeout(timer);
  }, [searchText]);

  const query = useInfiniteQuery<SalesResponse, Error>({
    queryKey: ["sales", debouncedSearchText],
    queryFn: ({ pageParam }) =>
      requestAPI<SalesResponse>(buildSalesPath(pageParam as number, debouncedSearchText), {
        accessToken: assertDefined(accessToken),
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.pagination.next ?? undefined,
    enabled: !!accessToken && enabled,
    placeholderData: keepPreviousData,
  });

  const sales = useMemo(() => query.data?.pages.flatMap((page) => page.purchases) ?? [], [query.data]);
  const totalCount = query.data?.pages[0]?.pagination.count ?? 0;
  const isSearching = !!searchText.trim() && (searchText.trim() !== debouncedSearchText || query.isLoading);

  return { ...query, sales, totalCount, isSearching };
};
