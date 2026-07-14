import { useDashboardSearch } from "@/app/(tabs)/_layout";
import { SaleDetailModal } from "@/components/dashboard/sale-detail-modal";
import { SaleItem } from "@/components/dashboard/sale-item";
import { SalePurchase, TimeRange, useSalesAnalytics } from "@/components/dashboard/use-sales-analytics";
import { ExportAllSalesButton } from "@/components/export-all-sales-button";
import { GettingStartedPlaceholder } from "@/components/getting-started-placeholder";
import { LineIcon } from "@/components/icon";
import { useSales } from "@/components/sales/use-sales";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useRef, useState } from "react";
import { FlatList, Pressable, RefreshControl, TextInput, View } from "react-native";
import { useCSSVariable } from "uniwind";

const TimeRangeButton = ({
  label,
  value,
  selected,
  onSelect,
}: {
  label: string;
  value: TimeRange;
  selected: boolean;
  onSelect: (value: TimeRange) => void;
}) => (
  <Button variant={selected ? "outline" : "ghost"} size="sm" className="rounded-full" onPress={() => onSelect(value)}>
    <Text>{label}</Text>
  </Button>
);

export default function Dashboard() {
  const { isLoading: isAuthLoading, isCreator } = useAuth();
  const {
    data,
    isLoading: isLoadingAnalytics,
    error,
    refetch,
    isRefetching,
    timeRange,
    setTimeRange,
  } = useSalesAnalytics({ enabled: isCreator });
  const accentColor = useCSSVariable("--color-accent") as string;
  const mutedColor = useCSSVariable("--color-muted") as string;
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const { isSearchActive, setSearchActive } = useDashboardSearch();
  const [searchText, setSearchText] = useState("");
  const isAllRange = timeRange === "all";
  const salesSearch = useSales(searchText, isCreator && isSearchActive, { requireQuery: true });
  const allSales = useSales("", isCreator && isAllRange && !isSearchActive);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (isSearchActive) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setSearchText("");
    }
  }, [isSearchActive]);

  const showAnalyticsError = !isSearchActive && !isAllRange && !!error;
  const showHeaderAnalyticsError = !isSearchActive && isAllRange && !!error;

  if (showAnalyticsError) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <Text className="font-sans text-foreground">Error: {error.message}</Text>
        </View>
      </Screen>
    );
  }

  if (isAuthLoading) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <LoadingSpinner size="large" />
        </View>
      </Screen>
    );
  }

  if (!isCreator) {
    return (
      <Screen>
        <GettingStartedPlaceholder message="Create your first product and your sales will show up here." />
      </Screen>
    );
  }

  const salesCount = data?.sales_count ?? 0;
  const isSearchIdle = isSearchActive && searchText.trim().length === 0;
  const displayData = isSearchActive
    ? isSearchIdle
      ? []
      : salesSearch.sales
    : isAllRange
      ? allSales.sales
      : (data?.purchases ?? []);
  const isLoading = isSearchActive
    ? !isSearchIdle && salesSearch.isSearching
    : isAllRange
      ? allSales.isLoading
      : isLoadingAnalytics;
  const salesError = isSearchActive && !isSearchIdle ? salesSearch.error : isAllRange ? allSales.error : null;

  const handleRefresh = () => {
    refetch();
    if (isAllRange) allSales.refetch();
  };

  const retrySales = () => {
    if (isSearchActive) salesSearch.refetch();
    else if (isAllRange) allSales.refetch();
  };

  return (
    <Screen>
      {isSearchActive ? (
        <View className="flex-row items-center gap-2 border-b border-border px-4 py-3">
          <Pressable onPress={() => setSearchActive(false)} hitSlop={8} className="pr-1">
            <LineIcon name="arrow-left-stroke" size={24} className="text-foreground" />
          </Pressable>
          <View className="flex-1 flex-row items-center rounded border border-border bg-background px-3 py-2">
            <LineIcon name="search" size={20} className="text-muted" />
            <TextInput
              ref={inputRef}
              className="ml-2 flex-1 font-sans text-base text-foreground"
              placeholder="Type to find purchases..."
              placeholderTextColor={mutedColor}
              value={searchText}
              onChangeText={setSearchText}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchText.length > 0 && (
              <Pressable onPress={() => setSearchText("")} hitSlop={8}>
                <LineIcon name="x" size={20} className="text-muted" />
              </Pressable>
            )}
          </View>
        </View>
      ) : (
        <View className="border-b border-border p-4">
          <View className="mb-4 h-20 items-center justify-center">
            {isLoadingAnalytics ? (
              <LoadingSpinner size="small" />
            ) : showHeaderAnalyticsError ? (
              <View className="flex-row items-center gap-2">
                <Text className="font-sans text-sm text-muted">Couldn&apos;t load totals.</Text>
                <Button variant="ghost" size="sm" onPress={() => refetch()}>
                  <Text>Retry</Text>
                </Button>
              </View>
            ) : (
              <>
                <Text className="font-sans text-4xl text-foreground">{data?.formatted_revenue ?? "$0"}</Text>
                <Text className="font-sans text-sm text-foreground">
                  from {salesCount.toLocaleString()} sale{salesCount !== 1 ? "s" : ""}
                </Text>
              </>
            )}
          </View>

          <View className="items-center gap-3">
            <View className="flex-row justify-center gap-2">
              <TimeRangeButton label="Today" value="day" selected={timeRange === "day"} onSelect={setTimeRange} />
              <TimeRangeButton label="Month" value="month" selected={timeRange === "month"} onSelect={setTimeRange} />
              <TimeRangeButton label="Year" value="year" selected={timeRange === "year"} onSelect={setTimeRange} />
              <TimeRangeButton label="All" value="all" selected={timeRange === "all"} onSelect={setTimeRange} />
            </View>
            <ExportAllSalesButton />
          </View>
        </View>
      )}

      {salesError ? (
        <View className="flex-1 items-center justify-center gap-4 p-4">
          <Text className="text-center font-sans text-lg text-muted">Couldn&apos;t load sales.</Text>
          <Button variant="outline" size="sm" onPress={retrySales}>
            <Text>Try again</Text>
          </Button>
        </View>
      ) : isLoading ? (
        <View className="flex-1 items-center justify-center">
          <LoadingSpinner size="large" />
        </View>
      ) : (
        <FlatList<SalePurchase>
          data={displayData}
          keyExtractor={(item) => item.id}
          refreshControl={
            !isSearchActive ? (
              <RefreshControl
                refreshing={isRefetching || (isAllRange && allSales.isRefetching)}
                onRefresh={handleRefresh}
                tintColor={accentColor}
              />
            ) : undefined
          }
          onEndReached={() => {
            if (isSearchActive) {
              if (!isSearchIdle && salesSearch.hasNextPage && !salesSearch.isFetchingNextPage)
                salesSearch.fetchNextPage();
            } else if (isAllRange && allSales.hasNextPage && !allSales.isFetchingNextPage) {
              allSales.fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.5}
          renderItem={({ item }) => <SaleItem sale={item} onPress={() => setSelectedSaleId(item.id)} />}
          ListEmptyComponent={
            <View className="items-center justify-center py-20">
              <Text className="font-sans text-lg text-muted">
                {isSearchIdle ? "Type to search your sales" : "No sales found"}
              </Text>
            </View>
          }
          ListFooterComponent={
            (isSearchActive ? salesSearch.isFetchingNextPage : isAllRange && allSales.isFetchingNextPage) ? (
              <View className="items-center py-4">
                <LoadingSpinner size="small" />
              </View>
            ) : null
          }
          keyboardShouldPersistTaps="handled"
        />
      )}

      <SaleDetailModal saleId={selectedSaleId} onClose={() => setSelectedSaleId(null)} />
    </Screen>
  );
}
