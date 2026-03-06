import { LibraryFilters } from "@/components/library/library-filters";
import { useLibraryFilters } from "@/components/library/use-library-filters";
import { Purchase, usePurchases, useSellers } from "@/components/library/use-purchases";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Screen } from "@/components/ui/screen";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { useRouter } from "expo-router";
import { useRef } from "react";
import { FlatList, Image, NativeScrollEvent, NativeSyntheticEvent, Text, TouchableOpacity, View } from "react-native";

export default function Index() {
  const { isLoading } = useAuth();
  const router = useRouter();

  const filters = useLibraryFilters();
  const query = usePurchases(filters.apiFilters);
  const { purchases, totalCount } = query;
  const sellers = useSellers(filters.apiFilters);

  // Pull-to-refresh without rendering the native RefreshControl UI
  const isPulling = useRef(false);
  const onScrollBeginDrag = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (e.nativeEvent.contentOffset.y <= 0) isPulling.current = true;
  };
  const onScrollEndDrag = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (isPulling.current && e.nativeEvent.contentOffset.y < -80) query.refetch();
    isPulling.current = false;
  };

  // onEndReachedThreshold is unreliable because of the layouts FlatList is inside; just loading on scroll works better
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const distanceFromEnd = contentSize.height - layoutMeasurement.height - contentOffset.y;
    if (distanceFromEnd < layoutMeasurement.height * 3 && query.hasNextPage && !query.isFetchingNextPage) {
      query.fetchNextPage();
    }
  };

  if (query.error) {
    return (
      <View className="flex-1 items-center justify-center bg-body-bg">
        <Text className="font-sans text-foreground">Error: {query.error.message}</Text>
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

  const isFilterLoading = filters.isSearchPending || (query.isFetching && !query.isFetchingNextPage);

  return (
    <Screen>
      <LibraryFilters {...filters} sellers={sellers}>
        {filters.hasActiveFilters && !isFilterLoading && (
          <View className="px-4 pb-4">
            <Text className="font-sans text-sm text-muted">
              Showing {totalCount} product{totalCount !== 1 ? "s" : ""}
            </Text>
          </View>
        )}

        {isFilterLoading && purchases.length === 0 ? (
          <View className="flex-1 items-center justify-center">
            <LoadingSpinner size="large" />
          </View>
        ) : (
          <FlatList<Purchase>
            numColumns={2}
            data={purchases}
            keyExtractor={(item, index) => item.purchase_id ?? index.toString()}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, gap: 12 }}
            columnWrapperStyle={{ gap: 12 }}
            onScrollBeginDrag={onScrollBeginDrag}
            onScrollEndDrag={onScrollEndDrag}
            onScroll={onScroll}
            scrollEventThrottle={200}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => router.push(`/purchase/${item.url_redirect_token}`)}
                className={cn(
                  "max-w-1/2 flex-1 overflow-hidden rounded border border-border bg-background",
                  isFilterLoading && "opacity-50",
                )}
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
                  <Text className="flex-1 font-sans text-sm text-foreground" numberOfLines={1}>
                    {item.creator_name}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              !isFilterLoading ? (
                <View className="items-center justify-center py-20">
                  <Text className="font-sans text-lg text-muted">
                    {filters.searchText || filters.hasActiveFilters ? "No matching products" : "No purchases yet"}
                  </Text>
                </View>
              ) : null
            }
            ListFooterComponent={
              query.isFetchingNextPage ? (
                <View className="w-full items-center py-4">
                  <LoadingSpinner size="small" />
                </View>
              ) : null
            }
          />
        )}
      </LibraryFilters>
    </Screen>
  );
}
