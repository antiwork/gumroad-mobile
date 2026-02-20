import { useCallback, useMemo, useState } from "react";
import { LayoutChangeEvent, PanResponder } from "react-native";
import { useCSSVariable } from "uniwind";

export interface ChartDataPoint {
  value: number;
  label?: string;
  frontColor?: string;
  topLabelComponent?: () => React.ReactNode;
}

export const CHART_HORIZONTAL_PADDING = 80;
const CHART_SIDE_PADDING = CHART_HORIZONTAL_PADDING / 2;

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
  const availableWidth = containerWidth > 0 ? containerWidth - CHART_HORIZONTAL_PADDING : 300;
  const barWidth = dataLength > 0 ? Math.max(4, (availableWidth - spacing * (dataLength - 1)) / dataLength) : 20;

  return {
    handleLayout,
    barWidth,
    spacing,
  };
};

export const useChartTouchSelection = ({
  barCount,
  barWidth,
  spacing,
  onSelectIndex,
}: {
  barCount: number;
  barWidth: number;
  spacing: number;
  onSelectIndex: (index: number) => void;
}) => {
  const selectIndexAtX = useCallback(
    (locationX: number) => {
      if (barCount < 1) return;

      const step = barWidth + spacing;
      const normalizedX = Math.max(0, locationX - CHART_SIDE_PADDING);
      const index = Math.round((normalizedX - barWidth / 2) / step);
      const clampedIndex = Math.max(0, Math.min(index, barCount - 1));
      onSelectIndex(clampedIndex);
    },
    [barCount, barWidth, onSelectIndex, spacing],
  );

  return useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => barCount > 0,
        onMoveShouldSetPanResponder: () => barCount > 0,
        onPanResponderGrant: (event) => selectIndexAtX(event.nativeEvent.locationX),
        onPanResponderMove: (event) => selectIndexAtX(event.nativeEvent.locationX),
      }).panHandlers,
    [barCount, selectIndexAtX],
  );
};
