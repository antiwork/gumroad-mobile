import { Text } from "@/components/ui/text";
import { useCallback, useState } from "react";
import { ScrollView, View } from "react-native";
import { BarChart } from "react-native-gifted-charts";
import { formatCurrency, formatDate, formatNumber, useChartColors } from "./analytics-bar-chart";
import { AnalyticsTimeRange } from "./use-analytics-by-date";
import { useAnalyticsByReferral } from "./use-analytics-by-referral";

interface TrafficTabProps {
  timeRange: AnalyticsTimeRange;
}

interface LegendItemProps {
  color: string;
  label: string;
  value: string;
}

const LegendItem = ({ color, label, value }: LegendItemProps) => (
  <View className="mb-1 flex-row items-center justify-between">
    <View className="flex-row items-center">
      <View style={{ backgroundColor: color }} className="mr-2 size-3 rounded-full" />
      <Text className="text-sm text-foreground">{label}</Text>
    </View>
    <Text className="text-sm text-muted">{value}</Text>
  </View>
);

export const TrafficTab = ({ timeRange }: TrafficTabProps) => {
  const { processedData, isLoading } = useAnalyticsByReferral(timeRange);
  const colors = useChartColors();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const { dates, revenue, visits, sales, topReferrers } = processedData;
  const groupBy = timeRange === "1w" || timeRange === "1m" ? "day" : "month";

  const activeIndex = selectedIndex ?? (dates.length > 0 ? dates.length - 1 : null);
  const selectedDate = activeIndex !== null && dates[activeIndex] ? formatDate(dates[activeIndex], groupBy) : "";

  const handleBarPress = useCallback((index: number) => {
    setSelectedIndex(index);
  }, []);

  const calculateTotals = (
    data: { date: string; referrers: { name: string; value: number; color: string }[] }[],
  ): Record<string, number> => {
    const totals: Record<string, number> = {};
    data.forEach((item) => {
      item.referrers.forEach((r) => {
        totals[r.name] = (totals[r.name] || 0) + r.value;
      });
    });
    return totals;
  };

  const getSelectedValues = (
    data: { date: string; referrers: { name: string; value: number; color: string }[] }[],
    index: number | null,
  ): Record<string, number> => {
    if (index === null || !data[index]) return {};
    const values: Record<string, number> = {};
    data[index].referrers.forEach((r) => {
      values[r.name] = r.value;
    });
    return values;
  };

  const revenueTotals = calculateTotals(revenue);
  const visitsTotals = calculateTotals(visits);
  const salesTotals = calculateTotals(sales);

  const selectedRevenueValues = getSelectedValues(revenue, activeIndex);
  const selectedVisitsValues = getSelectedValues(visits, activeIndex);
  const selectedSalesValues = getSelectedValues(sales, activeIndex);

  const totalRevenue = Object.values(revenueTotals).reduce((sum, val) => sum + val, 0);
  const totalVisits = Object.values(visitsTotals).reduce((sum, val) => sum + val, 0);
  const totalSales = Object.values(salesTotals).reduce((sum, val) => sum + val, 0);

  const createStackedChartData = (
    data: { date: string; referrers: { name: string; value: number; color: string }[] }[],
  ) => {
    return data.map((item, index) => {
      const stacks = item.referrers.map((r) => ({
        value: r.value || 0.1,
        color: r.color,
        onPress: () => handleBarPress(index),
      }));
      return {
        stacks,
        label: index === activeIndex ? formatDate(item.date, groupBy) : "",
      };
    });
  };

  const revenueChartData = createStackedChartData(revenue);
  const visitsChartData = createStackedChartData(visits);
  const salesChartData = createStackedChartData(sales);

  const hasData = dates.length > 0;
  const allZero = totalRevenue === 0 && totalVisits === 0 && totalSales === 0;

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

  const referrerColors: Record<string, string> = {};
  if (revenue.length > 0 && revenue[0].referrers) {
    revenue[0].referrers.forEach((r) => {
      referrerColors[r.name] = r.color;
    });
  }

  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
      <View className="p-4">
        <View className="mb-6 rounded border border-border bg-background p-4">
          <View className="mb-2 flex-row items-baseline justify-between">
            <Text className="text-sm text-muted">Revenue</Text>
            <Text className="text-xs text-muted">{selectedDate}</Text>
          </View>
          <Text className="mb-4 text-2xl font-bold text-foreground">{formatCurrency(totalRevenue)}</Text>
          <View className="mb-4">
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <BarChart
                stackData={revenueChartData}
                width={chartWidth}
                height={120}
                barWidth={barWidth}
                spacing={8}
                hideRules
                hideYAxisText
                disableScroll
                barBorderRadius={2}
                yAxisThickness={0}
                xAxisThickness={0}
              />
            </ScrollView>
          </View>
          <View className="border-t border-border pt-3">
            {topReferrers.map((name) => (
              <LegendItem
                key={name}
                color={referrerColors[name] || colors.muted}
                label={name}
                value={formatCurrency(selectedRevenueValues[name] || 0)}
              />
            ))}
          </View>
        </View>

        <View className="mb-6 rounded border border-border bg-background p-4">
          <View className="mb-2 flex-row items-baseline justify-between">
            <Text className="text-sm text-muted">Visits</Text>
            <Text className="text-xs text-muted">{selectedDate}</Text>
          </View>
          <Text className="mb-4 text-2xl font-bold text-foreground">{formatNumber(totalVisits)}</Text>
          <View className="mb-4">
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <BarChart
                stackData={visitsChartData}
                width={chartWidth}
                height={120}
                barWidth={barWidth}
                spacing={8}
                hideRules
                hideYAxisText
                disableScroll
                barBorderRadius={2}
                yAxisThickness={0}
                xAxisThickness={0}
              />
            </ScrollView>
          </View>
          <View className="border-t border-border pt-3">
            {topReferrers.map((name) => (
              <LegendItem
                key={name}
                color={referrerColors[name] || colors.muted}
                label={name}
                value={formatNumber(selectedVisitsValues[name] || 0)}
              />
            ))}
          </View>
        </View>

        <View className="mb-6 rounded border border-border bg-background p-4">
          <View className="mb-2 flex-row items-baseline justify-between">
            <Text className="text-sm text-muted">Sales</Text>
            <Text className="text-xs text-muted">{selectedDate}</Text>
          </View>
          <Text className="mb-4 text-2xl font-bold text-foreground">{formatNumber(totalSales)}</Text>
          <View className="mb-4">
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <BarChart
                stackData={salesChartData}
                width={chartWidth}
                height={120}
                barWidth={barWidth}
                spacing={8}
                hideRules
                hideYAxisText
                disableScroll
                barBorderRadius={2}
                yAxisThickness={0}
                xAxisThickness={0}
              />
            </ScrollView>
          </View>
          <View className="border-t border-border pt-3">
            {topReferrers.map((name) => (
              <LegendItem
                key={name}
                color={referrerColors[name] || colors.muted}
                label={name}
                value={formatNumber(selectedSalesValues[name] || 0)}
              />
            ))}
          </View>
        </View>
      </View>
    </ScrollView>
  );
};
