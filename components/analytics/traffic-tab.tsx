import { Text } from "@/components/ui/text";
import { useCallback, useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { BarChart } from "react-native-gifted-charts";
import { formatCurrency, formatNumber, useChartColors, useChartDimensions } from "./analytics-bar-chart";
import { ChartGestureHandler } from "./chart-gesture-handler";
import { ChartContainer } from "./chart-container";
import { AnalyticsTimeRange } from "./use-analytics-by-date";
import { useAnalyticsByReferral } from "./use-analytics-by-referral";

const CHART_HEIGHT = 120;

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

  const { dates, revenue, visits, sales } = processedData;
  const { handleLayout, barWidth, spacing } = useChartDimensions(dates.length);

  const activeIndex = selectedIndex;
  const selectedDate = activeIndex !== null && dates[activeIndex] ? dates[activeIndex] : "";

  useEffect(() => {
    setSelectedIndex((prev) => (prev !== null && prev >= dates.length ? null : prev));
  }, [dates.length]);

  useEffect(() => {
    setSelectedIndex(null);
  }, [timeRange]);

  const handleBarSelect = useCallback((index: number) => {
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

  const revenueTotals = calculateTotals(revenue.data);
  const visitsTotals = calculateTotals(visits.data);
  const salesTotals = calculateTotals(sales.data);

  const selectedRevenueValues = activeIndex !== null ? getSelectedValues(revenue.data, activeIndex) : revenueTotals;
  const selectedVisitsValues = activeIndex !== null ? getSelectedValues(visits.data, activeIndex) : visitsTotals;
  const selectedSalesValues = activeIndex !== null ? getSelectedValues(sales.data, activeIndex) : salesTotals;

  const totalRevenue = Object.values(revenueTotals).reduce((sum, val) => sum + val, 0);
  const totalVisits = Object.values(visitsTotals).reduce((sum, val) => sum + val, 0);
  const totalSales = Object.values(salesTotals).reduce((sum, val) => sum + val, 0);

  const selectedRevenue = Object.values(selectedRevenueValues).reduce((sum, val) => sum + val, 0);
  const selectedVisitsTotal = Object.values(selectedVisitsValues).reduce((sum, val) => sum + val, 0);
  const selectedSalesTotal = Object.values(selectedSalesValues).reduce((sum, val) => sum + val, 0);

  const createStackedChartData = (
    data: { date: string; referrers: { name: string; value: number; color: string }[] }[],
  ) =>
    data.map((item, index) => {
      const stacks = item.referrers.map((r, stackIndex) => ({
        value: r.value || 0,
        color: r.color,
        borderTopLeftRadius: stackIndex === item.referrers.length - 1 ? 4 : 0,
        borderTopRightRadius: stackIndex === item.referrers.length - 1 ? 4 : 0,
      }));
      return {
        stacks,
        label: index === activeIndex ? item.date : "",
      };
    });

  const revenueChartData = createStackedChartData(revenue.data);
  const visitsChartData = createStackedChartData(visits.data);
  const salesChartData = createStackedChartData(sales.data);

  const hasData = dates.length > 0;

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text className="text-muted">Loading...</Text>
      </View>
    );
  }

  const getReferrerColors = (
    data: { date: string; referrers: { name: string; value: number; color: string }[] }[],
  ): Record<string, string> => {
    const colors: Record<string, string> = {};
    if (data.length > 0 && data[0].referrers) {
      data[0].referrers.forEach((r) => {
        colors[r.name] = r.color;
      });
    }
    return colors;
  };

  const revenueReferrerColors = getReferrerColors(revenue.data);
  const visitsReferrerColors = getReferrerColors(visits.data);
  const salesReferrerColors = getReferrerColors(sales.data);

  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
      <View className="p-4 pt-0" onLayout={handleLayout}>
        <ChartContainer
          title="Revenue"
          selectedDate={selectedDate}
          showChart={hasData && totalRevenue > 0}
          emptyMessage="No referral revenue... yet"
        >
          <View className="mb-1 flex-row items-baseline justify-between">
            <Text className="text-2xl font-bold text-foreground">{formatCurrency(totalRevenue)}</Text>
            {activeIndex !== null && <Text className="text-lg text-accent">{formatCurrency(selectedRevenue)}</Text>}
          </View>
          <View>
            <ChartGestureHandler
              barWidth={barWidth}
              spacing={spacing}
              dataLength={dates.length}
              onBarSelect={handleBarSelect}
              height={CHART_HEIGHT}
            >
              <BarChart
                stackData={revenueChartData}
                height={CHART_HEIGHT}
                barWidth={barWidth}
                spacing={spacing}
                initialSpacing={0}
                endSpacing={0}
                hideRules
                hideYAxisText
                disableScroll
                yAxisThickness={0}
                xAxisThickness={1}
                xAxisColor={colors.border}
                highlightEnabled={activeIndex !== null}
                highlightedBarIndex={activeIndex ?? undefined}
                lowlightOpacity={0.4}
                disablePress
              />
            </ChartGestureHandler>
          </View>
          <View>
            {revenue.topReferrers.map((name) => (
              <LegendItem
                key={name}
                color={revenueReferrerColors[name] || colors.muted}
                label={name}
                value={formatCurrency(selectedRevenueValues[name] || 0)}
              />
            ))}
          </View>
        </ChartContainer>

        <ChartContainer
          title="Sales"
          selectedDate={selectedDate}
          showChart={hasData && totalSales > 0}
          emptyMessage="No referral sales... yet"
        >
          <View className="mb-1 flex-row items-baseline justify-between">
            <Text className="text-2xl font-bold text-foreground">{formatNumber(totalSales)}</Text>
            {activeIndex !== null && (
              <Text className="text-lg text-accent">
                {formatNumber(selectedSalesTotal)} sale{selectedSalesTotal !== 1 ? "s" : ""}
              </Text>
            )}
          </View>
          <View>
            <ChartGestureHandler
              barWidth={barWidth}
              spacing={spacing}
              dataLength={dates.length}
              onBarSelect={handleBarSelect}
              height={CHART_HEIGHT}
            >
              <BarChart
                stackData={salesChartData}
                height={CHART_HEIGHT}
                barWidth={barWidth}
                spacing={spacing}
                initialSpacing={0}
                endSpacing={0}
                hideRules
                hideYAxisText
                disableScroll
                yAxisThickness={0}
                xAxisThickness={1}
                xAxisColor={colors.border}
                highlightEnabled={activeIndex !== null}
                highlightedBarIndex={activeIndex ?? undefined}
                lowlightOpacity={0.4}
                disablePress
              />
            </ChartGestureHandler>
          </View>
          <View>
            {sales.topReferrers.map((name) => (
              <LegendItem
                key={name}
                color={salesReferrerColors[name] || colors.muted}
                label={name}
                value={formatNumber(selectedSalesValues[name] || 0)}
              />
            ))}
          </View>
        </ChartContainer>

        <ChartContainer
          title="Visits"
          selectedDate={selectedDate}
          showChart={hasData && totalVisits > 0}
          emptyMessage="No visits... yet"
        >
          <View className="mb-1 flex-row items-baseline justify-between">
            <Text className="text-2xl font-bold text-foreground">{formatNumber(totalVisits)}</Text>
            {activeIndex !== null && (
              <Text className="text-lg text-accent">
                {formatNumber(selectedVisitsTotal)} visit{selectedVisitsTotal !== 1 ? "s" : ""}
              </Text>
            )}
          </View>
          <View>
            <ChartGestureHandler
              barWidth={barWidth}
              spacing={spacing}
              dataLength={dates.length}
              onBarSelect={handleBarSelect}
              height={CHART_HEIGHT}
            >
              <BarChart
                stackData={visitsChartData}
                height={CHART_HEIGHT}
                barWidth={barWidth}
                spacing={spacing}
                initialSpacing={0}
                endSpacing={0}
                hideRules
                hideYAxisText
                disableScroll
                yAxisThickness={0}
                xAxisThickness={1}
                xAxisColor={colors.border}
                highlightEnabled={activeIndex !== null}
                highlightedBarIndex={activeIndex ?? undefined}
                lowlightOpacity={0.4}
                disablePress
              />
            </ChartGestureHandler>
          </View>
          <View>
            {visits.topReferrers.map((name) => (
              <LegendItem
                key={name}
                color={visitsReferrerColors[name] || colors.muted}
                label={name}
                value={formatNumber(selectedVisitsValues[name] || 0)}
              />
            ))}
          </View>
        </ChartContainer>
      </View>
    </ScrollView>
  );
};
