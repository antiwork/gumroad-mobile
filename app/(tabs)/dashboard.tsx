import { useDashboardSearch } from "@/app/(tabs)/_layout";
import { SaleDetailModal } from "@/components/dashboard/sale-detail-modal";
import { SaleItem } from "@/components/dashboard/sale-item";
import { usePurchaseSearch } from "@/components/dashboard/use-purchase-search";
import { SalePurchase, TimeRange, useSalesAnalytics } from "@/components/dashboard/use-sales-analytics";
import { LineIcon } from "@/components/icon";
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
  const { isLoading: isAuthLoading } = useAuth();
  const {
    data,
    isLoading: isLoadingAnalytics,
    error,
    refetch,
    isRefetching,
    timeRange,
    setTimeRange,
  } = useSalesAnalytics();
  const accentColor = useCSSVariable("--color-accent") as string;
  const mutedColor = useCSSVariable("--color-muted") as string;
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const { isSearchActive } = useDashboardSearch();
  const [searchText, setSearchText] = useState("");
  const { isSearching, searchResults } = usePurchaseSearch(searchText, data?.purchases ?? []);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (isSearchActive) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setSearchText("");
    }
  }, [isSearchActive]);

  if (error) {
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

  const salesCount = data?.sales_count ?? 0;
  const displayData = isSearchActive ? searchResults : (data?.purchases ?? []);
  const isLoading = isSearchActive ? isSearching : isLoadingAnalytics;

  return (
    <Screen>
      {isSearchActive ? (
        <View className="flex-row items-center gap-2 border-b border-border px-4 py-3">
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
            ) : (
              <>
                <Text className="font-sans text-4xl text-foreground">{data?.formatted_revenue ?? "$0"}</Text>
                <Text className="font-sans text-sm text-foreground">
                  from {salesCount} sale{salesCount !== 1 ? "s" : ""}
                </Text>
              </>
            )}
          </View>

          <View className="flex-row justify-center gap-2">
            <TimeRangeButton label="Today" value="day" selected={timeRange === "day"} onSelect={setTimeRange} />
            <TimeRangeButton label="Month" value="month" selected={timeRange === "month"} onSelect={setTimeRange} />
            <TimeRangeButton label="All time" value="all" selected={timeRange === "all"} onSelect={setTimeRange} />
          </View>
        </View>
      )}

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <LoadingSpinner size="large" />
        </View>
      ) : (
        <FlatList<SalePurchase>
          data={displayData}
          keyExtractor={(item) => item.id}
          refreshControl={
            !isSearchActive ? (
              <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={accentColor} />
            ) : undefined
          }
          renderItem={({ item }) => <SaleItem sale={item} onPress={() => setSelectedSaleId(item.id)} />}
          ListEmptyComponent={
            <View className="items-center justify-center py-20">
              <Text className="font-sans text-lg text-muted">No sales found</Text>
            </View>
          }
        />
      )}

      <SaleDetailModal saleId={selectedSaleId} onClose={() => setSelectedSaleId(null)} />
    </Screen>
  );
}
