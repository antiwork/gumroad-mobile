import { LibraryFilters } from "@/components/library/library-filters";
import { useLibraryFilters } from "@/components/library/use-library-filters";
import {
  Purchase,
  useArchivePurchase,
  useDeletePurchase,
  usePurchases,
  useSellers,
} from "@/components/library/use-purchases";
import { MAX_RECENT, useRecentPurchases } from "@/components/library/use-recent-products";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { StyledImage as Image } from "@/components/styled";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useRef } from "react";
import {
  Alert,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  TouchableOpacity,
  View,
} from "react-native";
import ContextMenu from "react-native-context-menu-view";
import * as Sentry from "@sentry/react-native";

const CarouselItem = ({ item, onPress }: { item: Purchase; onPress: () => void }) => (
  <TouchableOpacity onPress={onPress} className="size-50 overflow-hidden rounded">
    {item.thumbnail_url ? (
      <Image source={{ uri: item.thumbnail_url }} className="absolute inset-0" contentFit="cover" autoplay={false} />
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
        <Image source={{ uri: item.creator_profile_picture_url }} className="size-5 rounded-full border border-white" autoplay={false} />
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

  const archivePurchase = useArchivePurchase();
  const deletePurchase = useDeletePurchase();

  const handleArchive = useCallback(
    async (item: Purchase) => {
      if (!item.purchase_id) return;
      try {
        await archivePurchase(item.purchase_id, !item.is_archived);
      } catch (e) {
        Sentry.captureException(e);
        Alert.alert("Error", `Failed to ${item.is_archived ? "unarchive" : "archive"} product`);
      }
    },
    [archivePurchase],
  );

  const handleDelete = useCallback(
    (item: Purchase) => {
      if (!item.purchase_id) return;
      Alert.alert("Delete permanently?", `"${item.name}" will be removed from your library. This cannot be undone.`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deletePurchase(item.purchase_id!);
            } catch {
              Alert.alert("Error", "Failed to delete product");
            }
          },
        },
      ]);
    },
    [deletePurchase],
  );

  const recentPurchases = useRecentPurchases();
  useFocusEffect(
    useCallback(() => {
      recentPurchases.refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [recentPurchases.refresh]),
  );

  const carouselItems = useMemo(() => {
    let items = recentPurchases.purchases;

    if (items.length < MAX_RECENT) {
      items.push(
        ...purchases
          .filter((purchase) => !items.some(({ unique_permalink }) => purchase.unique_permalink === unique_permalink))
          .slice(0, MAX_RECENT - items.length),
      );
    }

    return items;
  }, [recentPurchases.purchases, purchases]);

  // Pull-to-refresh without rendering the native RefreshControl UI
  const isPulling = useRef(false);
  const onScrollBeginDrag = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (e.nativeEvent.contentOffset.y <= 0) isPulling.current = true;
  };
  const onScrollEndDrag = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (isPulling.current && e.nativeEvent.contentOffset.y < -80) {
      query.refetch();
      recentPurchases.refetch();
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
    filters.isSearchPending || (query.isFetching && !query.isFetchingNextPage) || recentPurchases.isLoading;

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
                        onPress={() =>
                          router.push({
                            pathname: "/purchase/[token]",
                            params: {
                              token: item.url_redirect_token,
                              urlRedirectExternalId: item.url_redirect_external_id,
                            },
                          })
                        }
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
              <>
                <ContextMenu
                  actions={[
                    {
                      title: item.is_archived ? "Unarchive" : "Archive",
                      systemIcon: item.is_archived ? "tray.and.arrow.up" : "archivebox",
                    },
                    {
                      title: "Delete permanently",
                      destructive: true,
                      systemIcon: "trash",
                    },
                  ]}
                  onPress={(e) => {
                    if (e.nativeEvent.index === 0) handleArchive(item);
                    else if (e.nativeEvent.index === 1) handleDelete(item);
                  }}
                >
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: "/purchase/[token]",
                        params: {
                          token: item.url_redirect_token,
                          urlRedirectExternalId: item.url_redirect_external_id,
                        },
                      })
                    }
                    onLongPress={() => {}}
                    className={cn("flex-row items-center gap-4", isFilterLoading && "opacity-50")}
                  >
                    {item.thumbnail_url ? (
                      <Image source={{ uri: item.thumbnail_url }} className="size-17 bg-muted" contentFit="cover" autoplay={false} />
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
                        <Image source={{ uri: item.creator_profile_picture_url }} className="size-4 rounded-full" autoplay={false} />
                        <Text className="text-sm text-muted" numberOfLines={1}>
                          {item.creator_name}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                </ContextMenu>
                <View className="h-px bg-border" />
              </>
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
