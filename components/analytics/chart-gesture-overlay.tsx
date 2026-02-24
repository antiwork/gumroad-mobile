import { useCallback, useRef } from "react";
import { LayoutChangeEvent, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

interface ChartGestureOverlayProps {
  dataLength: number;
  barWidth: number;
  spacing: number;
  onSelectIndex: (index: number) => void;
  children: React.ReactNode;
}

/**
 * Transparent gesture layer over a BarChart.
 * Handles tap-anywhere and pan/scrub to select bars by X position.
 */
export const ChartGestureOverlay = ({
  dataLength,
  barWidth,
  spacing,
  onSelectIndex,
  children,
}: ChartGestureOverlayProps) => {
  const containerWidth = useRef(0);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    containerWidth.current = e.nativeEvent.layout.width;
  }, []);

  const getIndexFromX = useCallback(
    (x: number): number | null => {
      if (dataLength <= 0 || containerWidth.current <= 0) return null;
      const totalBarSpace = barWidth + spacing;
      const index = Math.floor(x / totalBarSpace);
      if (index < 0) return 0;
      if (index >= dataLength) return dataLength - 1;
      return index;
    },
    [dataLength, barWidth, spacing],
  );

  const lastEmittedIndex = useRef<number | null>(null);

  const tap = Gesture.Tap().onEnd((e) => {
    const index = getIndexFromX(e.x);
    if (index !== null) {
      lastEmittedIndex.current = index;
      onSelectIndex(index);
    }
  });

  const pan = Gesture.Pan()
    .onStart((e) => {
      const index = getIndexFromX(e.x);
      if (index !== null) {
        lastEmittedIndex.current = index;
        onSelectIndex(index);
      }
    })
    .onUpdate((e) => {
      const index = getIndexFromX(e.x);
      if (index !== null && index !== lastEmittedIndex.current) {
        lastEmittedIndex.current = index;
        onSelectIndex(index);
      }
    })
    .activeOffsetX([-5, 5])
    .failOffsetY([-20, 20]);

  const gesture = Gesture.Race(pan, tap);

  return (
    <GestureDetector gesture={gesture}>
      <View onLayout={handleLayout} style={{ position: "relative" }}>
        {children}
        {/* Transparent overlay to capture gestures above short bars */}
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          }}
          pointerEvents="box-only"
        />
      </View>
    </GestureDetector>
  );
};
