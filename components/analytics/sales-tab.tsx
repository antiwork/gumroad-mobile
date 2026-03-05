import { Text } from "@/components/ui/text";
import { useCallback, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { BarChart } from "react-native-gifted-charts";
import { useCSSVariable } from "uniwind";
import { formatCurrency, formatNumber, useChartColors, useChartDimensions } from "./analytics-bar-chart";
import { ChartContainer } from "./chart-container";
import { InteractiveChart } from "./interactive-chart";
import { AnalyticsTimeRange, useAnalyticsByDate } from "./use-analytics-by-date";

export const SalesTab = ({ timeRange }: { timeRange: AnalyticsTimeRange }) => {
  const { processedData, isLoading } = useAnalyticsByDate(timeRange);
  const colors = useChartColors();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const accentColor = useCSSVariable("--color-accent") as string;

  const { dates, totals, sales, views } = processedData;
  const { handleLayout, barWidth, spacing } = useChartDimensions(dates.length);

  const activeIndex = selectedIndex;

  const totalRevenue = totals.reduce((sum, val) => sum + val, 0);
  const totalSales = sales.reduce((sum, val) => sum + val, 0);
  const totalViews = views.reduce((sum, val) => sum + val, 0);

  const selectedRevenue = activeIndex !== null ? totals[activeIndex] : 0;
  const selectedSales = activeIndex !== null ? sales[activeIndex] : 0;
  const selectedViews = activeIndex !== null ? views[activeIndex] : 0;
  const selectedDate = activeIndex !== null && dates[activeIndex] ? dates[activeIndex] : "";

  const lastPanIndex = useRef<number | null>(null);

  const handleBarPress = useCallback((index: number) => {
    setSelectedIndex((prev) => (prev === index ? null : index));
    lastPanIndex.current = null;
  }, []);

  const handleBarPan = useCallback((index: number) => {
    if (lastPanIndex.current === index) return;
    lastPanIndex.current = index;
    setSelectedIndex(index);
  }, []);

  const createChartData = (values: number[]) =>
    values.map((value, index) => ({
      value: value === 0 ? 0 : value,
      frontColor: index === activeIndex ? accentColor : colors.muted,
      onPress: () => handleBarPress(index),
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
          <InteractiveChart
            barWidth={barWidth}
            spacing={spacing}
            dataLength={totals.length}
            onBarSelect={handleBarPan}
          >
            <BarChart
              data={revenueData}
              height={120}
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
            />
          </InteractiveChart>
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
          <InteractiveChart
            barWidth={barWidth}
            spacing={spacing}
            dataLength={sales.length}
            onBarSelect={handleBarPan}
          >
            <BarChart
              data={salesData}
              height={120}
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
            />
          </InteractiveChart>
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
          <InteractiveChart
            barWidth={barWidth}
            spacing={spacing}
            dataLength={views.length}
            onBarSelect={handleBarPan}
          >
            <BarChart
              data={viewsData}
              height={120}
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
            />
          </InteractiveChart>
        </ChartContainer>
      </View>
    </ScrollView>
  );
};
