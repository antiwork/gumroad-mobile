import { useCallback, useState } from "react";
import { LayoutChangeEvent, View } from "react-native";
import { useCSSVariable } from "uniwind";

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

export const getBarIndexFromX = (
  x: number,
  barWidth: number,
  spacing: number,
  dataLength: number,
  initialSpacing = 0,
): number | null => {
  if (dataLength <= 0) return null;
  const adjustedX = x - initialSpacing;
  if (adjustedX <= 0) return 0;
  const index = Math.floor(adjustedX / (barWidth + spacing));
  return Math.max(0, Math.min(index, dataLength - 1));
};

export const CHART_HEIGHT = 120;
export const X_AXIS_THICKNESS = 1;
export const SELECTION_OVERLAY_HEIGHT = CHART_HEIGHT + X_AXIS_THICKNESS;

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

export const SelectionOverlay = ({
  activeIndex,
  barWidth,
  spacing,
}: {
  activeIndex: number;
  barWidth: number;
  spacing: number;
}) => {
  const [bodyBg] = useCSSVariable(["--color-body-bg"]);
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 4,
        height: SELECTION_OVERLAY_HEIGHT,
        left: activeIndex * (barWidth + spacing),
        width: barWidth,
        backgroundColor: bodyBg as string,
      }}
    />
  );
};
