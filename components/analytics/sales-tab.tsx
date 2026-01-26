import { Text } from "@/components/ui/text";
import { useCallback, useState } from "react";
import { ScrollView, View } from "react-native";
import { BarChart } from "react-native-gifted-charts";
import { useCSSVariable } from "uniwind";
import { formatCurrency, formatDate, formatNumber, getMinBarValue, useChartColors } from "./analytics-bar-chart";
import { AnalyticsTimeRange, useAnalyticsByDate } from "./use-analytics-by-date";

interface SalesTabProps {
  timeRange: AnalyticsTimeRange;
}

export const SalesTab = ({ timeRange }: SalesTabProps) => {
  const { processedData, isLoading } = useAnalyticsByDate(timeRange);
  const colors = useChartColors();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const accentColor = useCSSVariable("--color-accent") as string;

  const { dates, totals, sales, views } = processedData;
  const groupBy = timeRange === "1w" || timeRange === "1m" ? "day" : "month";

  const activeIndex = selectedIndex ?? (dates.length > 0 ? dates.length - 1 : null);

  const totalRevenue = totals.reduce((sum, val) => sum + val, 0);
  const totalSales = sales.reduce((sum, val) => sum + val, 0);
  const totalViews = views.reduce((sum, val) => sum + val, 0);

  const selectedRevenue = activeIndex !== null ? totals[activeIndex] : 0;
  const selectedSales = activeIndex !== null ? sales[activeIndex] : 0;
  const selectedViews = activeIndex !== null ? views[activeIndex] : 0;
  const selectedDate = activeIndex !== null && dates[activeIndex] ? formatDate(dates[activeIndex], groupBy) : "";

  const minRevenueBar = getMinBarValue(totals);
  const minSalesBar = getMinBarValue(sales);
  const minViewsBar = getMinBarValue(views);

  const handleBarPress = useCallback((index: number) => {
    setSelectedIndex(index);
  }, []);

  const createChartData = (values: number[], minBar: number) => {
    return values.map((value, index) => ({
      value: value === 0 ? minBar : value,
      frontColor: index === activeIndex ? accentColor : colors.muted,
      onPress: () => handleBarPress(index),
    }));
  };

  const revenueData = createChartData(totals, minRevenueBar);
  const salesData = createChartData(sales, minSalesBar);
  const viewsData = createChartData(views, minViewsBar);

  const hasData = dates.length > 0;
  const allZero = totalRevenue === 0 && totalSales === 0 && totalViews === 0;

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text className="text-muted">Loading...</Text>
      </View>
    );
  }

  if (!hasData || allZero) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text className="text-muted">No data available</Text>
      </View>
    );
  }

  const chartWidth = Math.max(dates.length * 30, 300);
  const barWidth = Math.max(16, Math.min(24, chartWidth / dates.length - 8));

  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
      <View className="p-4">
        <View className="mb-6 rounded border border-border bg-background p-4">
          <View className="mb-2 flex-row items-baseline justify-between">
            <Text className="text-sm text-muted">Revenue</Text>
            <Text className="text-xs text-muted">{selectedDate}</Text>
          </View>
          <View className="mb-1 flex-row items-baseline justify-between">
            <Text className="text-2xl font-bold text-foreground">{formatCurrency(totalRevenue)}</Text>
            <Text className="text-lg text-accent">{formatCurrency(selectedRevenue)}</Text>
          </View>
          <View className="mt-4">
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <BarChart
                data={revenueData}
                width={chartWidth}
                height={120}
                barWidth={barWidth}
                spacing={8}
                hideRules
                hideYAxisText
                hideAxesAndRules
                disableScroll
                isAnimated={false}
                barBorderRadius={2}
                yAxisThickness={0}
                xAxisThickness={0}
              />
            </ScrollView>
          </View>
        </View>

        <View className="mb-6 rounded border border-border bg-background p-4">
          <View className="mb-2 flex-row items-baseline justify-between">
            <Text className="text-sm text-muted">Sales</Text>
            <Text className="text-xs text-muted">{selectedDate}</Text>
          </View>
          <View className="mb-1 flex-row items-baseline justify-between">
            <Text className="text-2xl font-bold text-foreground">{formatNumber(totalSales)}</Text>
            <Text className="text-lg text-accent">
              {formatNumber(selectedSales)} sale{selectedSales !== 1 ? "s" : ""}
            </Text>
          </View>
          <View className="mt-4">
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <BarChart
                data={salesData}
                width={chartWidth}
                height={120}
                barWidth={barWidth}
                spacing={8}
                hideRules
                hideYAxisText
                hideAxesAndRules
                disableScroll
                isAnimated={false}
                barBorderRadius={2}
                yAxisThickness={0}
                xAxisThickness={0}
              />
            </ScrollView>
          </View>
        </View>

        <View className="mb-6 rounded border border-border bg-background p-4">
          <View className="mb-2 flex-row items-baseline justify-between">
            <Text className="text-sm text-muted">Views</Text>
            <Text className="text-xs text-muted">{selectedDate}</Text>
          </View>
          <View className="mb-1 flex-row items-baseline justify-between">
            <Text className="text-2xl font-bold text-foreground">{formatNumber(totalViews)}</Text>
            <Text className="text-lg text-accent">
              {formatNumber(selectedViews)} view{selectedViews !== 1 ? "s" : ""}
            </Text>
          </View>
          <View className="mt-4">
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <BarChart
                data={viewsData}
                width={chartWidth}
                height={120}
                barWidth={barWidth}
                spacing={8}
                hideRules
                hideYAxisText
                hideAxesAndRules
                disableScroll
                isAnimated={false}
                barBorderRadius={2}
                yAxisThickness={0}
                xAxisThickness={0}
              />
            </ScrollView>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};
