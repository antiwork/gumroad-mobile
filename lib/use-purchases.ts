import { assertDefined } from "@/lib/assert";
import { useAuth } from "@/lib/auth-context";
import { requestAPI, UnauthorizedError } from "@/lib/request";
import { InfiniteData, keepPreviousData, useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

export interface Purchase {
  name: string;
  creator_name: string;
  creator_username: string;
  creator_profile_picture_url: string;
  thumbnail_url: string | null;
  url_redirect_external_id?: string;
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

interface PurchaseDetailResponse {
  success: boolean;
  product: Purchase;
  purchase_valid: boolean;
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
    placeholderData: keepPreviousData,
  });

  const purchases = useMemo(() => query.data?.pages.flatMap((page) => page.purchases) ?? [], [query.data]);

  const sellers = useMemo(() => query.data?.pages[0]?.sellers ?? [], [query.data]);

  const totalCount = query.data?.pages[0]?.meta.pagination.count ?? 0;

  useEffect(() => {
    if ((!isAuthLoading && !accessToken) || query.error instanceof UnauthorizedError) logout();
  }, [isAuthLoading, accessToken, query.error, logout]);

  return { ...query, purchases, sellers, totalCount };
};

export const usePurchase = (id: string): Purchase | undefined => {
  const queryClient = useQueryClient();
  const { accessToken } = useAuth();

  const cachedPurchase = useMemo(() => {
    const queries = queryClient.getQueriesData<InfiniteData<SearchResponse>>({ queryKey: ["purchases"] });
    return queries
      .flatMap(([, data]) => data?.pages ?? [])
      .flatMap((page) => page.purchases)
      .find((p) => p.url_redirect_token === id);
  }, [queryClient, id]);

  const fallbackQuery = useInfiniteQuery<SearchResponse, Error>({
    queryKey: ["purchases", {}],
    queryFn: ({ pageParam }) =>
      requestAPI<SearchResponse>(buildSearchPath(pageParam as number, {}), {
        accessToken: assertDefined(accessToken),
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.meta.pagination.next ?? undefined,
    enabled: !!accessToken && !cachedPurchase,
  });

  const fallbackPurchase = useMemo(
    () =>
      fallbackQuery.data?.pages
        .flatMap((page) => page.purchases)
        .find((p) => p.url_redirect_token === id),
    [fallbackQuery.data, id],
  );

  const purchase = cachedPurchase ?? fallbackPurchase;

  const detailQuery = useQuery<PurchaseDetailResponse>({
    queryKey: ["purchase", id],
    queryFn: () =>
      requestAPI<PurchaseDetailResponse>(
        `mobile/url_redirects/get_url_redirect_attributes/${purchase?.url_redirect_external_id}`,
        { accessToken: assertDefined(accessToken) },
      ),
    enabled: !!accessToken && !!purchase?.url_redirect_external_id,
    placeholderData: purchase
      ? { success: true, product: purchase, purchase_valid: true }
      : undefined,
  });

  return detailQuery.data?.product ?? purchase;
};
