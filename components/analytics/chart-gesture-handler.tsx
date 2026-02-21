import { ReactNode, useCallback, useEffect, useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { CHART_X_OFFSET, getBarIndexFromX } from "./analytics-bar-chart";

const PAN_ACTIVE_OFFSET_X = 4;
const PAN_FAIL_OFFSET_Y = 12;

interface ChartGestureHandlerProps {
  children: ReactNode;
  dataLength: number;
  barWidth: number;
  spacing: number;
  height: number;
  onBarSelect: (index: number) => void;
  initialSpacing?: number;
  xOffset?: number;
}

export const ChartGestureHandler = ({
  children,
  dataLength,
  barWidth,
  spacing,
  height,
  onBarSelect,
  initialSpacing = 0,
  xOffset = CHART_X_OFFSET,
}: ChartGestureHandlerProps) => {
  const selectedIndexRef = useRef<number | null>(null);

  useEffect(() => {
    selectedIndexRef.current = null;
  }, [dataLength, barWidth, spacing, initialSpacing, xOffset]);

  const selectFromX = useCallback(
    (x: number) => {
      const index = getBarIndexFromX(x, barWidth, spacing, dataLength, initialSpacing, xOffset);
      if (index === null || selectedIndexRef.current === index) return;
      selectedIndexRef.current = index;
      onBarSelect(index);
    },
    [barWidth, spacing, dataLength, initialSpacing, xOffset, onBarSelect],
  );

  const tapGesture = useMemo(
    () => Gesture.Tap().onStart((event) => runOnJS(selectFromX)(event.x)),
    [selectFromX],
  );

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-PAN_ACTIVE_OFFSET_X, PAN_ACTIVE_OFFSET_X])
        .failOffsetY([-PAN_FAIL_OFFSET_Y, PAN_FAIL_OFFSET_Y])
        .onStart((event) => runOnJS(selectFromX)(event.x))
        .onUpdate((event) => runOnJS(selectFromX)(event.x)),
    [selectFromX],
  );

  return (
    <View style={styles.container}>
      {children}
      <GestureDetector gesture={Gesture.Race(tapGesture, panGesture)}>
        <View style={[styles.overlay, { height }]} />
      </GestureDetector>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "relative",
  },
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    zIndex: 1,
  },
});
