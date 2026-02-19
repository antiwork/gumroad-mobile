import { LibraryFilters } from "@/components/library-filters";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Screen } from "@/components/ui/screen";
import { useLibraryFilters } from "@/components/use-library-filters";
import { useAuth } from "@/lib/auth-context";
import { Purchase, usePurchases } from "@/lib/use-purchases";
import { useRouter } from "expo-router";
import { FlatList, Image, RefreshControl, Text, TouchableOpacity, View } from "react-native";
import { useCSSVariable } from "uniwind";

export default function Index() {
  const { isLoading } = useAuth();
  const {
    data: purchases = [],
    isLoading: isLoadingPurchases,
    error,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = usePurchases();
  const router = useRouter();
  const accentColor = useCSSVariable("--color-accent") as string;

  const filters = useLibraryFilters(purchases);

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
            refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={accentColor} />}
            onEndReached={() => {
              if (hasNextPage) fetchNextPage();
            }}
            onEndReachedThreshold={0.5}
            ListFooterComponent={isFetchingNextPage ? <LoadingSpinner size="small" /> : null}
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
          />
        </LibraryFilters>
      )}
    </Screen>
  );
}
