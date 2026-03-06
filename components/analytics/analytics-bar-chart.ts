import { useCallback, useState } from "react";
import { LayoutChangeEvent } from "react-native";
import { useCSSVariable } from "uniwind";

export const CHART_LEFT_OFFSET = 36;

export const getBarIndex = (x: number, barWidth: number, spacing: number, dataLength: number): number => {
  const adjusted = x - CHART_LEFT_OFFSET;
  const raw = Math.round(adjusted / (barWidth + spacing));
  return Math.max(0, Math.min(dataLength - 1, raw));
};

export interface ChartDataPoint {
  value: number;
  label?: string;
  frontColor?: string;
  topLabelComponent?: () => React.ReactNode;
}

export const useChartColors = () => {
  const [accent, muted, foreground, background, border] = useCSSVariable([
    "--color-accent",
    "--color-muted",
    "--color-foreground",
    "--color-background",
    "--color-border",
  ]);

  return {
    accent: accent as string,
    muted: muted as string,
    foreground: foreground as string,
    background: background as string,
    border: border as string,
  };
};

export const formatCurrency = (cents: number): string => {
  if (cents == null) return "$0.00";
  const dollars = cents / 100;
  if (dollars >= 1_000_000) {
    return `$${(dollars / 1_000_000).toFixed(1)}M`;
  }
  if (dollars >= 1_000) {
    return `$${(dollars / 1_000).toFixed(1)}K`;
  }
  return `$${dollars.toFixed(2)}`;
};

export const formatNumber = (num: number): string => {
  if (num == null) return "0";
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`;
  }
  return num.toLocaleString();
};

export const useChartDimensions = (dataLength: number) => {
  const [containerWidth, setContainerWidth] = useState(0);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    setContainerWidth(event.nativeEvent.layout.width);
  }, []);

  const spacing = 4;
  const chartPadding = 80;
  const availableWidth = containerWidth > 0 ? containerWidth - chartPadding : 300;
  const barWidth = dataLength > 0 ? Math.max(4, (availableWidth - spacing * (dataLength - 1)) / dataLength) : 20;

  return {
    handleLayout,
    barWidth,
    spacing,
  };
};
