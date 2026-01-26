import { SaleDetailModal } from "@/components/dashboard/sale-detail-modal";
import { SaleItem } from "@/components/dashboard/sale-item";
import { SalePurchase, TimeRange, useSalesAnalytics } from "@/components/dashboard/use-sales-analytics";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import { useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, View } from "react-native";
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
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);

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
          <ActivityIndicator size="large" color={accentColor} />
        </View>
      </Screen>
    );
  }

  const salesCount = data?.sales_count ?? 0;

  return (
    <Screen>
      <View className="border-b border-border p-4">
        <View className="mb-4 h-20 items-center justify-center">
          {isLoadingAnalytics ? (
            <ActivityIndicator size="small" color={accentColor} />
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

      {isLoadingAnalytics ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={accentColor} />
        </View>
      ) : (
        <FlatList<SalePurchase>
          data={data?.purchases ?? []}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={accentColor} />}
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
