import { LibraryFilters } from "@/components/library-filters";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Screen } from "@/components/ui/screen";
import { useLibraryFilters } from "@/components/use-library-filters";
import { assertDefined } from "@/lib/assert";
import { useAuth } from "@/lib/auth-context";
import { requestAPI, UnauthorizedError, useAPIRequest } from "@/lib/request";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useMemo } from "react";
import { FlatList, Image, RefreshControl, Text, TouchableOpacity, View } from "react-native";
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

interface PurchasesResponse {
  success: boolean;
  products: Purchase[];
  user_id: string;
}

interface CreatorFiltersResponse {
  success: boolean;
  sellers: {
    id: string;
    name: string;
    purchases_count: number;
  }[];
}

const PURCHASES_PER_PAGE = 24;

export const usePurchases = () => {
  const { accessToken, logout, isLoading: isAuthLoading } = useAuth();

  const query = useInfiniteQuery<PurchasesResponse, Error>({
    queryKey: ["purchases", PURCHASES_PER_PAGE],
    queryFn: ({ pageParam }) =>
      requestAPI<PurchasesResponse>(
        `mobile/purchases/index?page=${pageParam}&per_page=${PURCHASES_PER_PAGE}`,
        { accessToken: assertDefined(accessToken) },
      ),
    enabled: !!accessToken,
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.products.length === PURCHASES_PER_PAGE ? allPages.length + 1 : undefined,
  });

  useEffect(() => {
    if ((!isAuthLoading && !accessToken) || query.error instanceof UnauthorizedError) logout();
  }, [isAuthLoading, accessToken, query.error, logout]);

  const purchases = useMemo(() => query.data?.pages.flatMap((page) => page.products) ?? [], [query.data?.pages]);

  return {
    ...query,
    purchases,
  };
};

const useCreatorCounts = (archived: boolean) =>
  useAPIRequest<CreatorFiltersResponse, { username: string; name: string; count: number }[]>({
    queryKey: ["purchase-creator-counts", archived],
    url: `mobile/purchases/search?archived=${archived}&items=1`,
    select: (data) =>
      data.sellers
        .map((seller) => ({
          // We key by name because the purchase payload does not include seller external ID.
          username: seller.name,
          name: seller.name,
          count: seller.purchases_count,
        }))
        .sort((a, b) => {
          if (b.count !== a.count) return b.count - a.count;
          return a.name.localeCompare(b.name);
        }),
  });

export default function Index() {
  const { isLoading } = useAuth();
  const {
    purchases,
    isLoading: isLoadingPurchases,
    error,
    refetch,
    isRefetching,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = usePurchases();
  const { data: activeCreatorCounts = [] } = useCreatorCounts(false);
  const { data: archivedCreatorCounts = [] } = useCreatorCounts(true);
  const router = useRouter();
  const accentColor = useCSSVariable("--color-accent") as string;

  const filters = useLibraryFilters(purchases, {
    creatorCountsByArchivedState: {
      active: activeCreatorCounts,
      archived: archivedCreatorCounts,
    },
    hasArchivedProducts: archivedCreatorCounts.length > 0,
  });

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

  const totalUnfilteredCount = filters.showArchivedOnly
    ? purchases.filter((p) => p.is_archived).length
    : purchases.filter((p) => !p.is_archived).length;

  const showResultsCount = filters.filteredPurchases.length !== totalUnfilteredCount;

  return (
    <Screen>
      {isLoadingPurchases ? (
        <View className="flex-1 items-center justify-center">
          <LoadingSpinner size="large" />
        </View>
      ) : (
        <LibraryFilters {...filters}>
          {showResultsCount && (
            <View className="px-4 pb-4">
              <Text className="font-sans text-sm text-muted">
                Showing {filters.filteredPurchases.length} product
                {filters.filteredPurchases.length !== 1 ? "s" : ""}
              </Text>
            </View>
          )}

          <FlatList<Purchase>
            numColumns={2}
            data={filters.filteredPurchases}
            keyExtractor={(item) => item.url_redirect_token}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, gap: 12 }}
            columnWrapperStyle={{ gap: 12 }}
            onEndReachedThreshold={0.5}
            onEndReached={() => {
              if (hasNextPage && !isFetchingNextPage) {
                fetchNextPage();
              }
            }}
            refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={accentColor} />}
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
            ListEmptyComponent={
              <View className="items-center justify-center py-20">
                <Text className="font-sans text-lg text-muted">
                  {filters.searchText || filters.hasActiveFilters ? "No matching products" : "No purchases yet"}
                </Text>
              </View>
            }
            ListFooterComponent={
              isFetchingNextPage ? (
                <View className="py-4">
                  <LoadingSpinner size="small" />
                </View>
              ) : null
            }
          />
        </LibraryFilters>
      )}
    </Screen>
  );
}
