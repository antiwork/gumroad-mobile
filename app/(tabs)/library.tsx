import { LibraryFilters } from "@/components/library-filters";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Screen } from "@/components/ui/screen";
import { useLibraryFilters } from "@/components/use-library-filters";
import { useAuth } from "@/lib/auth-context";
import { useInfiniteAPIRequest } from "@/lib/request";
import { useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import { ActivityIndicator, FlatList, Image, RefreshControl, Text, TouchableOpacity, View } from "react-native";
import { useCSSVariable } from "uniwind";

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
  next: number | null;
  last: number;
}

export interface PurchasesSearchResponse {
  success: boolean;
  purchases: Purchase[];
  sellers: Seller[];
  user_id: string;
  meta: { pagination: PaginationMeta };
}

const ITEMS_PER_PAGE = 24;

export const usePurchases = (options?: {
  seller?: string[];
  archived?: boolean;
  sortBy?: string;
}) => {
  const params: Record<string, string | string[]> = {
    items: String(ITEMS_PER_PAGE),
  };

  if (options?.seller && options.seller.length > 0) {
    params["seller[]"] = options.seller;
  }

  if (options?.archived !== undefined) {
    params.archived = String(options.archived);
  }

  if (options?.sortBy === "purchased_at") {
    params["order[]"] = "date-desc";
  }

  return useInfiniteAPIRequest<PurchasesSearchResponse>({
    queryKey: ["purchases", options?.seller, options?.archived, options?.sortBy],
    url: "mobile/purchases/search",
    params,
    getNextPageParam: (lastPage) => lastPage.meta.pagination.next ?? undefined,
  });
};

export default function Index() {
  const { isLoading } = useAuth();
  const router = useRouter();
  const accentColor = useCSSVariable("--color-accent") as string;

  const filters = useLibraryFilters();

  const sellerIds = useMemo(
    () => (filters.selectedCreators.size > 0 ? Array.from(filters.selectedCreators) : undefined),
    [filters.selectedCreators],
  );

  const {
    data,
    isLoading: isLoadingPurchases,
    error,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = usePurchases({
    seller: sellerIds,
    archived: filters.showArchivedOnly ? true : undefined,
    sortBy: filters.sortBy,
  });

  const allPurchases = useMemo(() => data?.pages.flatMap((page: PurchasesSearchResponse) => page.purchases) ?? [], [data]);

  const sellers = useMemo(() => data?.pages[0]?.sellers ?? [], [data]);

  const filteredPurchases = useMemo(() => {
    if (!filters.searchText.trim()) return allPurchases;
    const search = filters.searchText.toLowerCase();
    return allPurchases.filter(
      (p: Purchase) => p.name.toLowerCase().includes(search) || p.creator_name.toLowerCase().includes(search),
    );
  }, [allPurchases, filters.searchText]);

  const totalCount = data?.pages[0]?.meta.pagination.count ?? 0;
  const showResultsCount = filters.searchText.trim() && filteredPurchases.length !== allPurchases.length;

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-body-bg">
        <Text className="font-sans text-foreground">Error: {error.message}</Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-body-bg">
        <LoadingSpinner size="large" />
      </View>
    );
  }

  return (
    <Screen>
      {isLoadingPurchases ? (
        <View className="flex-1 items-center justify-center">
          <LoadingSpinner size="large" />
        </View>
      ) : (
        <LibraryFilters {...filters} sellers={sellers} totalCount={totalCount}>
          {showResultsCount && (
            <View className="px-4 pb-4">
              <Text className="font-sans text-sm text-muted">
                Showing {filteredPurchases.length} product
                {filteredPurchases.length !== 1 ? "s" : ""}
              </Text>
            </View>
          )}

          <FlatList<Purchase>
            numColumns={2}
            data={filteredPurchases}
            keyExtractor={(item) => item.url_redirect_token}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, gap: 12 }}
            columnWrapperStyle={{ gap: 12 }}
            refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={accentColor} />}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.5}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => router.push(`/purchase/${item.url_redirect_token}`)}
                className="max-w-1/2 flex-1 overflow-hidden rounded border border-border bg-background"
              >
                {item.thumbnail_url ? (
                  <Image
                    source={{ uri: item.thumbnail_url }}
                    className="aspect-square bg-background"
                    resizeMode="cover"
                  />
                ) : (
                  <View className="aspect-square items-center justify-center bg-background">
                    <Text className="text-2xl">📦</Text>
                  </View>
                )}
                <View className="border-t border-border p-2">
                  <Text className="font-sans text-base text-foreground" numberOfLines={2}>
                    {item.name}
                  </Text>
                </View>
                <View className="mt-auto flex-row items-center gap-2 border-t border-border p-2">
                  <Image source={{ uri: item.creator_profile_picture_url }} className="size-4 rounded-full" />
                  <Text className="font-sans text-sm text-foreground">{item.creator_name}</Text>
                </View>
              </TouchableOpacity>
            )}
            ListFooterComponent={
              isFetchingNextPage ? (
                <View className="items-center py-4">
                  <ActivityIndicator color={accentColor} />
                </View>
              ) : null
            }
            ListEmptyComponent={
              <View className="items-center justify-center py-20">
                <Text className="font-sans text-lg text-muted">
                  {filters.searchText || filters.hasActiveFilters ? "No matching products" : "No purchases yet"}
                </Text>
              </View>
            }
          />
        </LibraryFilters>
      )}
    </Screen>
  );
}
