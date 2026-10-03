import { assertDefined } from "@/lib/assert";
import { useAuth } from "@/lib/auth-context";
import { reportLibraryLoadFailure } from "@/lib/library-load-report";
import { requestAPI, UnauthorizedError } from "@/lib/request";
import { InfiniteData, keepPreviousData, useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef } from "react";

export interface PostFile {
  id: string;
  name: string;
  filegroup?: string;
  streaming_url?: string;
  latest_media_location?: { location: number };
  content_length?: number;
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

export const fetchPurchaseDetail = (urlRedirectExternalId: string, accessToken: string) =>
  requestAPI<PurchaseDetailResponse>(`mobile/url_redirects/get_url_redirect_attributes/${urlRedirectExternalId}`, {
    accessToken,
  });

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

export const usePurchases = (filters: ApiFilters = {}, options: { reportLoadFailure?: boolean } = {}) => {
  const { accessToken, logout, isLoading: isAuthLoading } = useAuth();
  const reportLoadFailure = options.reportLoadFailure ?? true;

  // Time each attempt so a failed library load can report how long it ran — the 30s
  // REQUEST_TIMEOUT_MS abort is the symptom gp#3224 is about — without making the request
  // layer carry the clock.
  const lastAttemptMs = useRef<number | null>(null);

  const query = useInfiniteQuery<SearchResponse, Error>({
    queryKey: ["purchases", filters],
    queryFn: async ({ pageParam }) => {
      const startedAt = Date.now();
      try {
        return await requestAPI<SearchResponse>(buildSearchPath(pageParam as number, filters), {
          accessToken: assertDefined(accessToken),
        });
      } finally {
        lastAttemptMs.current = Date.now() - startedAt;
      }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.meta.pagination.next ?? undefined,
    enabled: !!accessToken,
    placeholderData: keepPreviousData,
  });

  // gp#3224: the Library screen shows a generic "Couldn't load your library" and lib/sentry.ts
  // drops AbortError, so a failed load left no app-side trace. Report one sanitized, deduped
  // signal per failure (reason + endpoint + elapsed, no payload) so these are visible again.
  useEffect(() => {
    if (!reportLoadFailure || !query.isError || !query.error) return;
    reportLibraryLoadFailure(query.error, lastAttemptMs.current, query.failureCount);
  }, [reportLoadFailure, query.isError, query.error, query.failureCount]);

  const purchases = useMemo(() => query.data?.pages.flatMap((page) => page.purchases) ?? [], [query.data]);

  const sellers = useMemo(() => query.data?.pages[0]?.sellers ?? [], [query.data]);

  const totalCount = query.data?.pages[0]?.meta.pagination.count ?? 0;

  useEffect(() => {
    if ((!isAuthLoading && !accessToken) || query.error instanceof UnauthorizedError) logout();
  }, [isAuthLoading, accessToken, query.error, logout]);

  return { ...query, purchases, sellers, totalCount };
};

export const useSellers = ({ seller, ...filtersWithoutSeller }: ApiFilters = {}) => {
  // Silenced: the sellers query is a second `purchases` query keyed on the filters without
  // `seller`, so it would double-report the same library load failure. Only the Library
  // screen's primary usePurchases call reports.
  const { sellers } = usePurchases(filtersWithoutSeller, { reportLoadFailure: false });
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
    queryFn: () => fetchPurchaseDetail(assertDefined(url_redirect_external_id), assertDefined(accessToken)),
    enabled: !!accessToken && !!url_redirect_external_id,
    placeholderData: cachedPurchase ? { success: true, product: cachedPurchase, purchase_valid: true } : undefined,
  });

  return detailQuery.data?.product;
};

const removePurchaseFromCache = (queryClient: ReturnType<typeof useQueryClient>, purchaseId: string) => {
  const previousData = new Map<string, InfiniteData<SearchResponse>>();
  const queries = queryClient.getQueriesData<InfiniteData<SearchResponse>>({ queryKey: ["purchases"] });
  for (const [key, data] of queries) {
    if (!data) continue;
    previousData.set(JSON.stringify(key), data);
    queryClient.setQueryData<InfiniteData<SearchResponse>>(key, {
      ...data,
      pages: data.pages.map((page) => ({
        ...page,
        purchases: page.purchases.filter((p) => p.purchase_id !== purchaseId),
        meta: {
          ...page.meta,
          pagination: { ...page.meta.pagination, count: page.meta.pagination.count - 1 },
        },
      })),
    });
  }
  return () => {
    for (const [key, data] of previousData) {
      queryClient.setQueryData(JSON.parse(key), data);
    }
  };
};

export const useArchivePurchase = () => {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useCallback(
    async (purchaseId: string, archive: boolean) => {
      const rollback = removePurchaseFromCache(queryClient, purchaseId);
      try {
        const action = archive ? "archive" : "unarchive";
        await requestAPI(`mobile/purchases/${purchaseId}/${action}`, {
          accessToken: assertDefined(accessToken),
          method: "POST",
        });
      } catch (e) {
        rollback();
        throw e;
      }
    },
    [accessToken, queryClient],
  );
};

export const useDeletePurchase = () => {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useCallback(
    async (purchaseId: string) => {
      const rollback = removePurchaseFromCache(queryClient, purchaseId);
      try {
        await requestAPI(`mobile/purchases/${purchaseId}`, {
          accessToken: assertDefined(accessToken),
          method: "DELETE",
        });
      } catch (e) {
        rollback();
        throw e;
      }
    },
    [accessToken, queryClient],
  );
};
