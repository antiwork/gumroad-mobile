import { useCallback, useRef, useState } from "react";
import { GestureResponderEvent, LayoutChangeEvent, ScrollView, View } from "react-native";
import { useCSSVariable } from "uniwind";

export interface ChartDataPoint {
  value: number;
  label?: string;
  frontColor?: string;
  topLabelComponent?: () => React.ReactNode;
}

export const useChartColors = () => {
  const [accent, muted, foreground, background, border, bodyBg] = useCSSVariable([
    "--color-accent",
    "--color-muted",
    "--color-foreground",
    "--color-background",
    "--color-border",
    "--color-body-bg",
  ]);

  return {
    accent: accent as string,
    muted: muted as string,
    foreground: foreground as string,
    background: background as string,
    border: border as string,
    bodyBg: bodyBg as string,
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
  const chartPadding = 80;
  const availableWidth = containerWidth > 0 ? containerWidth - chartPadding : 300;
  const barWidth = dataLength > 0 ? Math.max(4, (availableWidth - spacing * (dataLength - 1)) / dataLength) : 20;

  return {
    handleLayout,
    barWidth,
    spacing,
  };
};

export const CHART_HEIGHT = 120;
export const X_AXIS_THICKNESS = 1;
export const SELECTION_OVERLAY_HEIGHT = CHART_HEIGHT + X_AXIS_THICKNESS;

export const useChartScrubbing = (barWidth: number, spacing: number, dataLength: number) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const isScrubbing = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  const chartLayoutRef = useRef<Record<string, number>>({});

  const getBarIndexFromPageX = useCallback(
    (pageX: number, chartKey: string) => {
      const chartLeft = chartLayoutRef.current[chartKey] ?? 0;
      const x = pageX - chartLeft;
      const index = Math.floor(x / (barWidth + spacing));
      return Math.max(0, Math.min(index, dataLength - 1));
    },
    [barWidth, spacing, dataLength],
  );

  const getChartTouchProps = (chartKey: string) => ({
    onLayout: (e: LayoutChangeEvent) => {
      (e.target as unknown as View).measureInWindow((x: number) => {
        chartLayoutRef.current[chartKey] = x;
      });
    },
    onStartShouldSetResponderCapture: () => true,
    onMoveShouldSetResponderCapture: () => true,
    onResponderGrant: (e: GestureResponderEvent) => {
      isScrubbing.current = false;
      scrollRef.current?.setNativeProps({ scrollEnabled: false });
      (e.currentTarget as unknown as View).measureInWindow((x: number) => {
        chartLayoutRef.current[chartKey] = x;
      });
    },
    onResponderMove: (e: GestureResponderEvent) => {
      isScrubbing.current = true;
      const index = getBarIndexFromPageX(e.nativeEvent.pageX, chartKey);
      if (index >= 0 && index < dataLength) {
        setSelectedIndex(index);
      }
    },
    onResponderRelease: (e: GestureResponderEvent) => {
      scrollRef.current?.setNativeProps({ scrollEnabled: true });
      if (!isScrubbing.current) {
        const index = getBarIndexFromPageX(e.nativeEvent.pageX, chartKey);
        if (index >= 0 && index < dataLength) {
          setSelectedIndex((prev) => (prev === index ? null : index));
        }
      }
      isScrubbing.current = false;
    },
  });

  return { selectedIndex, scrollRef, getChartTouchProps };
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
