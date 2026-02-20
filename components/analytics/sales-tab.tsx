import { Text } from "@/components/ui/text";
import { useCallback, useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { BarChart } from "react-native-gifted-charts";
import { useCSSVariable } from "uniwind";
import { formatCurrency, formatNumber, useChartColors, useChartDimensions } from "./analytics-bar-chart";
import { ChartGestureHandler } from "./chart-gesture-handler";
import { ChartContainer } from "./chart-container";
import { AnalyticsTimeRange, useAnalyticsByDate } from "./use-analytics-by-date";

const CHART_HEIGHT = 120;

export const SalesTab = ({ timeRange }: { timeRange: AnalyticsTimeRange }) => {
  const { processedData, isLoading } = useAnalyticsByDate(timeRange);
  const colors = useChartColors();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const accentColor = useCSSVariable("--color-accent") as string;

  const { dates, totals, sales, views } = processedData;
  const { handleLayout, barWidth, spacing } = useChartDimensions(dates.length);

  const activeIndex = selectedIndex;

  useEffect(() => {
    setSelectedIndex((prev) => (prev !== null && prev >= dates.length ? null : prev));
  }, [dates.length]);

  useEffect(() => {
    setSelectedIndex(null);
  }, [timeRange]);

  const totalRevenue = totals.reduce((sum, val) => sum + val, 0);
  const totalSales = sales.reduce((sum, val) => sum + val, 0);
  const totalViews = views.reduce((sum, val) => sum + val, 0);

  const selectedRevenue = activeIndex !== null ? totals[activeIndex] : 0;
  const selectedSales = activeIndex !== null ? sales[activeIndex] : 0;
  const selectedViews = activeIndex !== null ? views[activeIndex] : 0;
  const selectedDate = activeIndex !== null && dates[activeIndex] ? dates[activeIndex] : "";

  const handleBarSelect = useCallback((index: number) => {
    setSelectedIndex(index);
  }, []);

  const createChartData = (values: number[]) =>
    values.map((value, index) => ({
      value: value === 0 ? 0 : value,
      frontColor: index === activeIndex ? accentColor : colors.muted,
    }));

  const revenueData = createChartData(totals);
  const salesData = createChartData(sales);
  const viewsData = createChartData(views);

  const hasData = dates.length > 0;

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text className="text-muted">Loading...</Text>
      </View>
    );
  }

  const showRevenueChart = hasData && totalRevenue > 0;
  const showSalesChart = hasData && totalSales > 0;
  const showViewsChart = hasData && totalViews > 0;

  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
      <View className="p-4 pt-0" onLayout={handleLayout}>
        <ChartContainer
          title="Revenue"
          selectedDate={selectedDate}
          showChart={showRevenueChart}
          emptyMessage="No sales revenue... yet"
        >
          <View className="mb-1 flex-row items-baseline justify-between">
            <Text className="text-2xl font-bold text-foreground">{formatCurrency(totalRevenue)}</Text>
            {activeIndex !== null && <Text className="text-lg text-accent">{formatCurrency(selectedRevenue)}</Text>}
          </View>
          <View className="mt-4">
            <ChartGestureHandler
              barWidth={barWidth}
              spacing={spacing}
              dataLength={dates.length}
              onBarSelect={handleBarSelect}
              height={CHART_HEIGHT}
            >
              <BarChart
                data={revenueData}
                height={CHART_HEIGHT}
                barWidth={barWidth}
                spacing={spacing}
                initialSpacing={0}
                endSpacing={0}
                hideRules
                hideYAxisText
                disableScroll
                isAnimated={false}
                barBorderTopLeftRadius={4}
                barBorderTopRightRadius={4}
                yAxisThickness={0}
                xAxisThickness={1}
                xAxisColor={colors.border}
                disablePress
              />
            </ChartGestureHandler>
          </View>
        </ChartContainer>

        <ChartContainer
          title="Sales"
          selectedDate={selectedDate}
          showChart={showSalesChart}
          emptyMessage="No sales... yet"
        >
          <View className="mb-1 flex-row items-baseline justify-between">
            <Text className="text-2xl font-bold text-foreground">{formatNumber(totalSales)}</Text>
            {activeIndex !== null && (
              <Text className="text-lg text-accent">
                {formatNumber(selectedSales)} sale{selectedSales !== 1 ? "s" : ""}
              </Text>
            )}
          </View>
          <View className="mt-4">
            <ChartGestureHandler
              barWidth={barWidth}
              spacing={spacing}
              dataLength={dates.length}
              onBarSelect={handleBarSelect}
              height={CHART_HEIGHT}
            >
              <BarChart
                data={salesData}
                height={CHART_HEIGHT}
                barWidth={barWidth}
                spacing={spacing}
                initialSpacing={0}
                endSpacing={0}
                hideRules
                hideYAxisText
                disableScroll
                isAnimated={false}
                barBorderTopLeftRadius={4}
                barBorderTopRightRadius={4}
                yAxisThickness={0}
                xAxisThickness={1}
                xAxisColor={colors.border}
                disablePress
              />
            </ChartGestureHandler>
          </View>
        </ChartContainer>

        <ChartContainer
          title="Views"
          selectedDate={selectedDate}
          showChart={showViewsChart}
          emptyMessage="No views... yet"
        >
          <View className="mb-1 flex-row items-baseline justify-between">
            <Text className="text-2xl font-bold text-foreground">{formatNumber(totalViews)}</Text>
            {activeIndex !== null && (
              <Text className="text-lg text-accent">
                {formatNumber(selectedViews)} view{selectedViews !== 1 ? "s" : ""}
              </Text>
            )}
          </View>
          <View className="mt-4">
            <ChartGestureHandler
              barWidth={barWidth}
              spacing={spacing}
              dataLength={dates.length}
              onBarSelect={handleBarSelect}
              height={CHART_HEIGHT}
            >
              <BarChart
                data={viewsData}
                height={CHART_HEIGHT}
                barWidth={barWidth}
                spacing={spacing}
                initialSpacing={0}
                endSpacing={0}
                hideRules
                hideYAxisText
                disableScroll
                isAnimated={false}
                barBorderTopLeftRadius={4}
                barBorderTopRightRadius={4}
                yAxisThickness={0}
                xAxisThickness={1}
                xAxisColor={colors.border}
                disablePress
              />
            </ChartGestureHandler>
          </View>
        </ChartContainer>
      </View>
    </ScrollView>
  );
};
