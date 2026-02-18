import { LibraryFilters } from "@/components/library-filters";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Screen } from "@/components/ui/screen";
import { Purchase, useLibraryPurchases } from "@/components/use-library-purchases";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "expo-router";
import { ActivityIndicator, FlatList, Image, RefreshControl, Text, TouchableOpacity, View } from "react-native";
import { useCSSVariable } from "uniwind";

export default function Index() {
  const { isLoading } = useAuth();
  const router = useRouter();
  const accentColor = useCSSVariable("--color-accent") as string;

  const {
    purchases,
    sellers,
    totalCount,
    isLoading: isLoadingPurchases,
    isRefetching,
    isRefreshing,
    isFetchingNextPage,
    hasNextPage,
    error,
    refetch,
    handleRefresh,
    fetchNextPage,

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
  } = useLibraryPurchases();

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

  const showResultsCount = searchQuery.trim().length > 0 || hasActiveFilters;

  return (
    <Screen>
      {isLoadingPurchases ? (
        <View className="flex-1 items-center justify-center">
          <LoadingSpinner size="large" />
        </View>
      ) : (
        <LibraryFilters
          searchText={searchQuery}
          setSearchText={setSearchQuery}
          selectedSellers={selectedSellers}
          showArchivedOnly={showArchivedOnly}
          sortBy={sortBy}
          setSortBy={setSortBy}
          hasActiveFilters={hasActiveFilters}
          sellers={sellers}
          handleSellerToggle={handleSellerToggle}
          handleSelectAllSellers={handleSelectAllSellers}
          handleClearFilters={handleClearFilters}
          handleToggleArchived={handleToggleArchived}
        >
          {showResultsCount && (
            <View className="px-4 pb-4">
              <Text className="font-sans text-sm text-muted">
                Showing {purchases.length} of {totalCount} product{totalCount !== 1 ? "s" : ""}
              </Text>
            </View>
          )}

          <FlatList<Purchase>
            numColumns={2}
            data={purchases}
            keyExtractor={(item, index) => `${item.url_redirect_token}-${index}`}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, gap: 12 }}
            columnWrapperStyle={{ gap: 12 }}
            refreshControl={
              <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={accentColor} />
            }
            onEndReached={() => {
              if (hasNextPage && !isFetchingNextPage) fetchNextPage();
            }}
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
                  {searchQuery || hasActiveFilters ? "No matching products" : "No purchases yet"}
                </Text>
              </View>
            }
          />
        </LibraryFilters>
      )}
    </Screen>
  );
}
