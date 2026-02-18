import { API_ENDPOINTS } from "@/lib/api-endpoints";
import { assertDefined } from "@/lib/assert";
import { useAuth } from "@/lib/auth-context";
import { requestAPI, UnauthorizedError } from "@/lib/request";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

export type SortOption = "content_updated_at" | "purchased_at";

const ITEMS_PER_PAGE = 10;

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

interface PaginationMeta {
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
    meta: { pagination: PaginationMeta };
}

interface SearchParams {
    query: string;
    selectedSellers: string[];
    showArchivedOnly: boolean;
}

const buildSearchUrl = (params: SearchParams, page: number) => {
    const urlParams = new URLSearchParams();
    urlParams.set("page", String(page));
    urlParams.set("items", String(ITEMS_PER_PAGE));
    urlParams.set("order", "date-desc");

    if (params.query.trim()) {
        urlParams.set("q", params.query.trim());
    }

    if (params.showArchivedOnly) {
        urlParams.set("archived", "true");
    } else {
        urlParams.set("archived", "false");
    }

    for (const sellerId of params.selectedSellers) {
        urlParams.append("seller_ids[]", sellerId);
    }

    return `${API_ENDPOINTS.PURCHASES.SEARCH}?${urlParams.toString()}`;
};

export const useLibraryPurchases = () => {
    const { accessToken, logout, isLoading: isAuthLoading } = useAuth();

    const [searchQuery, setSearchQuery] = useState("");
    const [sortBy, setSortBy] = useState<SortOption>("content_updated_at");
    const [selectedSellers, setSelectedSellers] = useState<Set<string>>(new Set());
    const [showArchivedOnly, setShowArchivedOnly] = useState(false);

    const searchParams: SearchParams = useMemo(
        () => ({
            query: searchQuery,
            selectedSellers: Array.from(selectedSellers).sort(),
            showArchivedOnly,
        }),
        [searchQuery, selectedSellers, showArchivedOnly],
    );

    const query = useInfiniteQuery<SearchResponse, Error>({
        queryKey: ["library-purchases", searchParams],
        queryFn: ({ pageParam }) =>
            requestAPI<SearchResponse>(buildSearchUrl(searchParams, pageParam as number), {
                accessToken: assertDefined(accessToken),
            }),
        initialPageParam: 1,
        getNextPageParam: (lastPage) => lastPage.meta.pagination.next,
        enabled: !!accessToken,
    });

    const sellersQuery = useQuery<{ success: boolean; sellers: Seller[] }, Error, Seller[]>({
        queryKey: ["library-sellers", showArchivedOnly],
        queryFn: () => {
            const urlParams = new URLSearchParams();
            if (showArchivedOnly) {
                urlParams.set("archived", "true");
            } else {
                urlParams.set("archived", "false");
            }
            return requestAPI<{ success: boolean; sellers: Seller[] }>(`${API_ENDPOINTS.PURCHASES.CREATORS}?${urlParams.toString()}`, {
                accessToken: assertDefined(accessToken),
            });
        },
        select: (data) => data.sellers,
        enabled: !!accessToken,
        staleTime: 5 * 60 * 1000,
    });

    useEffect(() => {
        if ((!isAuthLoading && !accessToken) || query.error instanceof UnauthorizedError) logout();
    }, [isAuthLoading, accessToken, query.error, logout]);

    const purchases = useMemo(() => {
        const all = query.data?.pages.flatMap((page) => page.purchases) ?? [];

        return [...all].sort((a, b) => {
            const aDate = sortBy === "content_updated_at" ? a.content_updated_at : a.purchased_at;
            const bDate = sortBy === "content_updated_at" ? b.content_updated_at : b.purchased_at;
            if (!aDate && !bDate) return 0;
            if (!aDate) return 1;
            if (!bDate) return -1;
            return new Date(bDate).getTime() - new Date(aDate).getTime();
        });
    }, [query.data, sortBy]);

    const sellers = sellersQuery.data ?? [];

    const totalCount = query.data?.pages[0]?.meta.pagination.count ?? 0;

    const hasActiveFilters = selectedSellers.size > 0 || showArchivedOnly;

    const handleSellerToggle = (sellerId: string) => {
        setSelectedSellers((prev) => {
            const next = new Set(prev);
            if (next.has(sellerId)) {
                next.delete(sellerId);
            } else {
                next.add(sellerId);
            }
            return next;
        });
    };

    const handleSelectAllSellers = () => {
        setSelectedSellers(new Set());
    };

    const handleClearFilters = () => {
        setSelectedSellers(new Set());
        setShowArchivedOnly(false);
    };

    const handleToggleArchived = () => {
        setShowArchivedOnly((prev) => !prev);
    };

    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            await Promise.all([query.refetch(), sellersQuery.refetch()]);
        } finally {
            setIsRefreshing(false);
        }
    };

    return {
        purchases,
        sellers,
        totalCount,
        isLoading: query.isLoading,
        isRefetching: query.isRefetching,
        isRefreshing,
        isFetchingNextPage: query.isFetchingNextPage,
        hasNextPage: query.hasNextPage,
        error: query.error,
        refetch: query.refetch,
        handleRefresh,
        fetchNextPage: query.fetchNextPage,

        searchQuery,
        setSearchQuery,
        sortBy,
        setSortBy,
        selectedSellers,
        showArchivedOnly,
        hasActiveFilters,
        handleSellerToggle,
        handleSelectAllSellers,
        handleClearFilters,
        handleToggleArchived,
    };
};
