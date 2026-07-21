import { Text } from "@/components/ui/text";
import { useCallback, useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { BarChart } from "react-native-gifted-charts";
import {
  CHART_HEIGHT,
  formatCurrency,
  formatNumber,
  ProjectionOverlay,
  SelectionOverlay,
  useChartColors,
  useChartDimensions,
} from "./analytics-bar-chart";
import { ChartContainer } from "./chart-container";
import { ChartGestureHandler } from "./chart-gesture-handler";
import { dayProgress, projectedEndOfDayTotal, todaysBucketLabel } from "./projected-end-of-day-total";
import { AnalyticsTimeRange, useAnalyticsByDate } from "./use-analytics-by-date";

export const SalesTab = ({ timeRange }: { timeRange: AnalyticsTimeRange }) => {
  const { processedData, isLoading, sellerTimeZone } = useAnalyticsByDate(timeRange);
  const colors = useChartColors();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const { dates, totals, sales, views } = processedData;
  const { handleLayout, barWidth, spacing } = useChartDimensions(dates.length);

  const activeIndex = selectedIndex !== null && selectedIndex < dates.length ? selectedIndex : null;

  useEffect(() => {
    setSelectedIndex(null);
  }, [timeRange]);

  const totalRevenue = totals.reduce((sum, val) => sum + val, 0);
  const totalSales = sales.reduce((sum, val) => sum + val, 0);
  const totalViews = views.reduce((sum, val) => sum + val, 0);

  // Every range except "1y" can end on the seller's current day. For "1d" the whole
  // hourly range is today; for day-grouped ranges, locate today's bucket by matching
  // the backend's day label (e.g. "Monday, July 20th") instead of assuming it is the
  // last bucket, so an omitted, incomplete, or reordered response never projects
  // another day's revenue. Project today's revenue to an end-of-day total from the
  // run rate so far, matching the web analytics chart.
  const progress = timeRange !== "1y" && sellerTimeZone ? dayProgress(sellerTimeZone) : null;
  const todayLabel = sellerTimeZone ? todaysBucketLabel(sellerTimeZone) : null;
  const todaysBucketIndex = timeRange === "1d" || todayLabel === null ? -1 : dates.indexOf(todayLabel);
  const todaysRevenue =
    timeRange === "1d" ? totalRevenue : todaysBucketIndex >= 0 ? (totals[todaysBucketIndex] ?? 0) : null;
  const projectedRevenue = todaysRevenue !== null ? projectedEndOfDayTotal(todaysRevenue, progress) : null;
  const projection =
    projectedRevenue !== null && todaysRevenue !== null && projectedRevenue > todaysRevenue ? projectedRevenue : null;

  const selectedRevenue = activeIndex !== null ? totals[activeIndex] : 0;
  const selectedSales = activeIndex !== null ? sales[activeIndex] : 0;
  const selectedViews = activeIndex !== null ? views[activeIndex] : 0;
  const selectedDate = activeIndex !== null && dates[activeIndex] ? dates[activeIndex] : "";

  const handleBarSelect = useCallback((index: number) => {
    setSelectedIndex((prev) => (prev === index ? null : index));
  }, []);

  const createChartData = (values: number[]) =>
    values.map((value, index) => ({
      value: value === 0 ? 0 : value,
      frontColor: index === activeIndex ? colors.accent : colors.muted,
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

  // The projection bar sits behind today's bar (the bucket matching today's label in
  // a day-grouped range) and shares the chart's value scale, so the chart max must
  // account for the projection possibly exceeding every actual bar. The hourly "Today"
  // view skips the bar (a whole-day projection has no single hourly bar to sit behind)
  // and shows the projected total as text only.
  const projectionIndex = todaysBucketIndex;
  const maxRevenueBar = totals.reduce((max, val) => Math.max(max, val), 0);
  const revenueChartMax = Math.max(maxRevenueBar, projection ?? 0);
  const showProjectionBar = projection !== null && timeRange !== "1d" && projectionIndex >= 0 && showRevenueChart;

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
            {activeIndex !== null ? (
              <Text className="text-lg text-accent">{formatCurrency(selectedRevenue)}</Text>
            ) : projection !== null ? (
              <Text className="text-sm text-muted">{formatCurrency(projection)} projected today</Text>
            ) : null}
          </View>
          <View className="mt-4">
            {showProjectionBar && (
              <ProjectionOverlay
                projectedValue={projection}
                maxValue={revenueChartMax}
                barWidth={barWidth}
                spacing={spacing}
                index={projectionIndex}
                color={colors.accent}
              />
            )}
            {activeIndex !== null && (
              <SelectionOverlay activeIndex={activeIndex} barWidth={barWidth} spacing={spacing} />
            )}
            <ChartGestureHandler
              barWidth={barWidth}
              spacing={spacing}
              dataLength={dates.length}
              onBarSelect={handleBarSelect}
            >
              <BarChart
                data={revenueData}
                height={CHART_HEIGHT}
                maxValue={showProjectionBar ? revenueChartMax : undefined}
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
                yAxisLabelWidth={0}
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
            {activeIndex !== null && (
              <SelectionOverlay activeIndex={activeIndex} barWidth={barWidth} spacing={spacing} />
            )}
            <ChartGestureHandler
              barWidth={barWidth}
              spacing={spacing}
              dataLength={dates.length}
              onBarSelect={handleBarSelect}
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
                yAxisLabelWidth={0}
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
            {activeIndex !== null && (
              <SelectionOverlay activeIndex={activeIndex} barWidth={barWidth} spacing={spacing} />
            )}
            <ChartGestureHandler
              barWidth={barWidth}
              spacing={spacing}
              dataLength={dates.length}
              onBarSelect={handleBarSelect}
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
                yAxisLabelWidth={0}
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
