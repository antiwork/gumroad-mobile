import { LibraryFilters } from "@/components/library/library-filters";
import { useLibraryFilters } from "@/components/library/use-library-filters";
import { Purchase, usePurchases, useSellers } from "@/components/library/use-purchases";
import { MAX_RECENT, useRecentProducts } from "@/components/library/use-recent-products";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useRef } from "react";
import {
  FlatList,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  TouchableOpacity,
  View,
} from "react-native";

const CarouselItem = ({ item, onPress }: { item: Purchase; onPress: () => void }) => (
  <TouchableOpacity onPress={onPress} className="size-50 overflow-hidden rounded">
    {item.thumbnail_url ? (
      <Image source={{ uri: item.thumbnail_url }} className="absolute inset-0" resizeMode="cover" />
    ) : (
      <View className="absolute inset-0 items-center justify-center bg-muted">
        <Text className="text-4xl">📦</Text>
      </View>
    )}
    <View className="absolute inset-0 bg-black/40" />
    <View className="flex-1 justify-end p-3">
      <Text className="text-sm font-bold text-white" numberOfLines={3}>
        {item.name}
      </Text>
      <View className="mt-1 flex-row items-center gap-1.5">
        <Image source={{ uri: item.creator_profile_picture_url }} className="size-5 rounded-full border border-white" />
        <Text className="font-sans text-xs text-white" numberOfLines={1}>
          {item.creator_name}
        </Text>
      </View>
    </View>
  </TouchableOpacity>
);

export default function Index() {
  const { isLoading } = useAuth();
  const router = useRouter();

  const filters = useLibraryFilters();
  const query = usePurchases(filters.apiFilters);
  const { purchases, totalCount } = query;
  const sellers = useSellers(filters.apiFilters);

  const recentProducts = useRecentProducts();
  useFocusEffect(
    useCallback(() => {
      recentProducts.refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [recentProducts.refresh]),
  );

  const carouselItems = useMemo(() => {
    let items = recentProducts.purchases;

    if (items.length < MAX_RECENT) {
      items.push(
        ...purchases
          .filter((purchase) => !items.some(({ unique_permalink }) => purchase.unique_permalink === unique_permalink))
          .slice(0, MAX_RECENT - items.length),
      );
    }

    return items;
  }, [recentProducts.purchases, purchases]);

  // Pull-to-refresh without rendering the native RefreshControl UI
  const isPulling = useRef(false);
  const onScrollBeginDrag = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (e.nativeEvent.contentOffset.y <= 0) isPulling.current = true;
  };
  const onScrollEndDrag = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (isPulling.current && e.nativeEvent.contentOffset.y < -80) {
      query.refetch();
      recentProducts.refetch();
    }
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
        <Text>Error: {query.error.message}</Text>
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

  const isFilterLoading =
    filters.isSearchPending || (query.isFetching && !query.isFetchingNextPage) || recentProducts.isLoading;

  return (
    <Screen>
      <LibraryFilters {...filters} sellers={sellers}>
        {isFilterLoading && purchases.length === 0 ? (
          <View className="flex-1 items-center justify-center">
            <LoadingSpinner size="large" />
          </View>
        ) : (
          <FlatList<Purchase>
            data={purchases}
            keyExtractor={(item, index) => item.purchase_id ?? index.toString()}
            contentContainerStyle={{ paddingBottom: 16 }}
            onScrollBeginDrag={onScrollBeginDrag}
            onScrollEndDrag={onScrollEndDrag}
            onScroll={onScroll}
            scrollEventThrottle={200}
            ListHeaderComponent={
              <>
                {carouselItems.length > 0 && !filters.hasActiveFilters ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 16, gap: 16, paddingBottom: 16 }}
                  >
                    {carouselItems.map((item) => (
                      <CarouselItem
                        key={item.purchase_id ?? item.url_redirect_token}
                        item={item}
                        onPress={() => router.push(`/purchase/${item.url_redirect_token}`)}
                      />
                    ))}
                  </ScrollView>
                ) : null}
                <View className="border-b border-border px-4 py-3">
                  <Text className="text-sm">Showing {totalCount} products</Text>
                </View>
              </>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => router.push(`/purchase/${item.url_redirect_token}`)}
                className={cn("flex-row items-center gap-4 border-b border-border", isFilterLoading && "opacity-50")}
              >
                {item.thumbnail_url ? (
                  <Image source={{ uri: item.thumbnail_url }} className="size-17 bg-muted" resizeMode="cover" />
                ) : (
                  <View className="size-17 items-center justify-center bg-muted">
                    <Text className="text-2xl">📦</Text>
                  </View>
                )}
                <View className="flex-1 gap-1">
                  <Text className="text-base font-bold" numberOfLines={1}>
                    {item.name}
                  </Text>
                  <View className="flex-row items-center gap-1.5">
                    <Image source={{ uri: item.creator_profile_picture_url }} className="size-4 rounded-full" />
                    <Text className="text-sm text-muted" numberOfLines={1}>
                      {item.creator_name}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              !isFilterLoading ? (
                <View className="items-center justify-center py-20">
                  <Text className="text-lg text-muted">
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
