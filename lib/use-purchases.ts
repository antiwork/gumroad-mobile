import { assertDefined } from "@/lib/assert";
import { useAuth } from "@/lib/auth-context";
import { requestAPI, UnauthorizedError } from "@/lib/request";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo } from "react";

export interface Purchase {
  name: string;
  creator_name: string;
  creator_username: string;
  creator_profile_picture_url: string;
  thumbnail_url: string | null;
  url_redirect_token: string;
  purchase_email: string;
  purchase_id?: string;
  is_archived?: boolean;
  content_updated_at?: string;
  purchased_at?: string;
  file_data?: {
    id: string;
    name: string;
    filegroup?: string;
    streaming_url?: string;
  }[];
}

export interface Seller {
  id: string;
  name: string;
  purchases_count: number;
}

export interface ApiFilters {
  q?: string;
  seller?: string[];
  archived?: boolean;
  order?: "date-desc" | "date-asc";
}

interface Pagination {
  count: number;
  items: number;
  page: number;
  pages: number;
  prev: number | null;
  next: number | null;
  last: number;
}

interface SearchResponse {
  success: boolean;
  user_id: string;
  purchases: Purchase[];
  sellers: Seller[];
  meta: { pagination: Pagination };
}

const PER_PAGE = 24;

const buildSearchPath = (page: number, filters: ApiFilters) => {
  const params = new URLSearchParams();
  params.set("items", String(PER_PAGE));
  params.set("page", String(page));
  if (filters.q) params.set("q", filters.q);
  if (filters.seller?.length) {
    for (const id of filters.seller) params.append("seller[]", id);
  }
  if (filters.archived !== undefined) params.set("archived", String(filters.archived));
  if (filters.order) params.set("order", filters.order);
  return `mobile/purchases/search?${params.toString()}`;
};

export const usePurchases = (filters: ApiFilters = {}) => {
  const { accessToken, logout, isLoading: isAuthLoading } = useAuth();

  const query = useInfiniteQuery<SearchResponse, Error>({
    queryKey: ["purchases", filters],
    queryFn: ({ pageParam }) =>
      requestAPI<SearchResponse>(buildSearchPath(pageParam as number, filters), {
        accessToken: assertDefined(accessToken),
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.meta.pagination.next ?? undefined,
    enabled: !!accessToken,
  });

  const purchases = useMemo(() => query.data?.pages.flatMap((page) => page.purchases) ?? [], [query.data]);

  const sellers = useMemo(() => query.data?.pages[0]?.sellers ?? [], [query.data]);

  const totalCount = query.data?.pages[0]?.meta.pagination.count ?? 0;

  const refetch = useCallback(() => query.refetch(), [query.refetch]);

  const fetchNextPage = useCallback(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
  }, [query.hasNextPage, query.isFetchingNextPage, query.fetchNextPage]);

  useEffect(() => {
    if ((!isAuthLoading && !accessToken) || query.error instanceof UnauthorizedError) logout();
  }, [isAuthLoading, accessToken, query.error, logout]);

  return {
    purchases,
    sellers,
    totalCount,
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage ?? false,
    error: query.error,
    refetch,
    fetchNextPage,
  };
};

const findPurchaseInCache = (queryClient: ReturnType<typeof useQueryClient>, id: string): Purchase | undefined =>
  queryClient
    .getQueriesData<{ pages: SearchResponse[] }>({ queryKey: ["purchases"] })
    .flatMap(([, data]) => data?.pages ?? [])
    .flatMap((page) => page.purchases)
    .find((p) => p.url_redirect_token === id);

export const usePurchase = (id: string) => {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const cachedPurchase = findPurchaseInCache(queryClient, id);

  const query = useQuery<Purchase | undefined, Error>({
    queryKey: ["purchase", id],
    queryFn: async () => {
      const response = await requestAPI<SearchResponse>(
        `mobile/purchases/search?${new URLSearchParams({ q: id, items: "1" }).toString()}`,
        { accessToken: assertDefined(accessToken) },
      );
      return response.purchases.find((p) => p.url_redirect_token === id);
    },
    enabled: !!accessToken && !cachedPurchase,
    initialData: cachedPurchase,
    staleTime: 5 * 60 * 1000,
  });

  return cachedPurchase ?? query.data;
};
