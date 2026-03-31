import { assertDefined } from "@/lib/assert";
import { useAuth } from "@/lib/auth-context";
import { requestAPI, UnauthorizedError } from "@/lib/request";
import { InfiniteData, keepPreviousData, useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

export interface PostFile {
  id: string;
  name: string;
  filegroup?: string;
  streaming_url?: string;
}

export interface Post {
  external_id: string;
  name: string;
  message: string;
  installment_type?: string;
  published_at: string;
  url_redirect_external_id?: string;
  creator_name: string;
  creator_profile_url: string;
  creator_profile_picture_url: string;
  call_to_action_text?: string;
  call_to_action_url?: string;
  files_data?: PostFile[];
}

export interface Purchase {
  name: string;
  unique_permalink: string;
  creator_name: string;
  creator_username: string;
  creator_profile_url: string;
  creator_profile_picture_url: string;
  thumbnail_url: string | null;
  url_redirect_external_id?: string;
  url_redirect_token: string;
  purchase_email: string;
  purchase_id?: string;
  is_archived?: boolean;
  content_updated_at?: string;
  purchased_at?: string;
  file_data?: PostFile[];
  product_updates_data?: Post[];
}

export interface Seller {
  id: string;
  name: string;
  purchases_count: number;
}

export interface ApiFilters {
  q?: string;
  seller?: string[];
  products?: string[];
  purchase_ids?: string[];
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

export interface SearchResponse {
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

export const buildSearchPath = (page: number, filters: ApiFilters) => {
  const params = new URLSearchParams();
  params.set("items", String(PER_PAGE));
  params.set("page", String(page));
  if (filters.q) params.set("q", filters.q);
  if (filters.seller?.length) {
    for (const id of filters.seller) params.append("seller[]", id);
  }
  if (filters.products?.length) {
    for (const id of filters.products) params.append("products[]", id);
  }
  if (filters.purchase_ids?.length) {
    for (const id of filters.purchase_ids) params.append("purchase_ids[]", id);
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

export const useSellers = ({ seller, ...filtersWithoutSeller }: ApiFilters = {}) => {
  const { sellers } = usePurchases(filtersWithoutSeller);
  return sellers;
};

export const usePost = (urlRedirectToken: string, postExternalId: string): Post | undefined => {
  const purchase = usePurchase(urlRedirectToken);
  return useMemo(
    () => purchase?.product_updates_data?.find((p) => p.external_id === postExternalId),
    [purchase, postExternalId],
  );
};

interface InstallmentResponse {
  success: boolean;
  installment: Post;
}

export const useInstallment = (
  installmentId: string,
  params: { purchaseId?: string; subscriptionId?: string; followerId?: string },
): Post | undefined => {
  const { accessToken } = useAuth();

  const queryParams = new URLSearchParams();
  if (params.purchaseId) queryParams.set("purchase_id", params.purchaseId);
  else if (params.subscriptionId) queryParams.set("subscription_id", params.subscriptionId);
  else if (params.followerId) queryParams.set("follower_id", params.followerId);
  const query = queryParams.toString();

  const { data } = useQuery<InstallmentResponse>({
    queryKey: ["installment", installmentId, query],
    queryFn: () =>
      requestAPI<InstallmentResponse>(`mobile/installments/${installmentId}${query ? `?${query}` : ""}`, {
        accessToken: assertDefined(accessToken),
      }),
    enabled: !!accessToken && !!installmentId,
  });

  return data?.installment;
};

export const usePurchase = (url_redirect_external_id: string | undefined): Purchase | undefined => {
  const queryClient = useQueryClient();
  const { accessToken } = useAuth();

  const cachedPurchase = useMemo(() => {
    const queries = queryClient.getQueriesData<InfiniteData<SearchResponse>>({ queryKey: ["purchases"] });
    return queries
      .flatMap(([, data]) => data?.pages ?? [])
      .flatMap((page) => page.purchases)
      .find((p) => p.url_redirect_external_id === url_redirect_external_id);
  }, [queryClient, url_redirect_external_id]);

  const detailQuery = useQuery<PurchaseDetailResponse>({
    queryKey: ["purchase", url_redirect_external_id],
    queryFn: () =>
      requestAPI<PurchaseDetailResponse>(
        `mobile/url_redirects/get_url_redirect_attributes/${url_redirect_external_id}`,
        { accessToken: assertDefined(accessToken) },
      ),
    enabled: !!accessToken && !!url_redirect_external_id,
    placeholderData: cachedPurchase ? { success: true, product: cachedPurchase, purchase_valid: true } : undefined,
  });

  return detailQuery.data?.product;
};
