import { ReactNode, useCallback, useMemo, useRef } from "react";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { getBarIndexFromX } from "./analytics-bar-chart";

const PAN_ACTIVE_OFFSET_X = 4;
const PAN_FAIL_OFFSET_Y = 12;

export const ChartGestureHandler = ({
  children,
  dataLength,
  barWidth,
  spacing,
  onBarSelect,
}: {
  children: ReactNode;
  dataLength: number;
  barWidth: number;
  spacing: number;
  onBarSelect: (index: number) => void;
}) => {
  const selectedIndexRef = useRef<number | null>(null);

  const selectFromX = useCallback(
    (x: number) => {
      const index = getBarIndexFromX(x, barWidth, spacing, dataLength);
      if (index === null || selectedIndexRef.current === index) return;
      selectedIndexRef.current = index;
      onBarSelect(index);
    },
    [barWidth, spacing, dataLength, onBarSelect],
  );

  const resetRef = useCallback(() => {
    selectedIndexRef.current = null;
  }, []);

  const tapGesture = useMemo(
    () =>
      Gesture.Tap()
        .onStart((event) => runOnJS(selectFromX)(event.x))
        .onEnd(() => runOnJS(resetRef)()),
    [selectFromX, resetRef],
  );

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-PAN_ACTIVE_OFFSET_X, PAN_ACTIVE_OFFSET_X])
        .failOffsetY([-PAN_FAIL_OFFSET_Y, PAN_FAIL_OFFSET_Y])
        .onStart((event) => runOnJS(selectFromX)(event.x))
        .onUpdate((event) => runOnJS(selectFromX)(event.x))
        .onEnd(() => runOnJS(resetRef)()),
    [selectFromX, resetRef],
  );

  const composedGesture = useMemo(
    () => Gesture.Race(tapGesture, panGesture),
    [tapGesture, panGesture],
  );

  return (
    <View className="relative">
      {children}
      <GestureDetector gesture={composedGesture}>
        <View className="absolute inset-0 z-10" />
      </GestureDetector>
    </View>
  );
};
