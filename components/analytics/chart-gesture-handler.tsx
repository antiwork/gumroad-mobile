import { getBarIndex } from "@/components/analytics/analytics-bar-chart";
import { useRef } from "react";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

const TAP_MAX_DISTANCE = 10;
const PAN_ACTIVE_OFFSET_X = 5;
const PAN_FAIL_OFFSET_Y = 20;

export const ChartGestureHandler = ({
  barWidth,
  spacing,
  dataLength,
  onTapBar,
  onScrubBar,
  children,
}: {
  barWidth: number;
  spacing: number;
  dataLength: number;
  onTapBar: (index: number) => void;
  onScrubBar: (index: number) => void;
  children: React.ReactNode;
}) => {
  const lastPanIndex = useRef(-1);

  const resolveIndex = (x: number) => getBarIndex(x, barWidth, spacing, dataLength);

  const tap = Gesture.Tap()
    .maxDistance(TAP_MAX_DISTANCE)
    .onEnd((e) => onTapBar(resolveIndex(e.x)))
    .runOnJS(true);

  const pan = Gesture.Pan()
    .activeOffsetX([-PAN_ACTIVE_OFFSET_X, PAN_ACTIVE_OFFSET_X])
    .failOffsetY([-PAN_FAIL_OFFSET_Y, PAN_FAIL_OFFSET_Y])
    .onStart((e) => {
      const index = resolveIndex(e.x);
      lastPanIndex.current = index;
      onScrubBar(index);
    })
    .onUpdate((e) => {
      const index = resolveIndex(e.x);
      if (index !== lastPanIndex.current) {
        lastPanIndex.current = index;
        onScrubBar(index);
      }
    })
    .onEnd(() => {
      lastPanIndex.current = -1;
    })
    .runOnJS(true);

  const gesture = Gesture.Exclusive(pan, tap);

  return (
    <GestureDetector gesture={gesture}>
      <View>{children}</View>
    </GestureDetector>
  );
};
