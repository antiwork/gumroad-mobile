import * as Haptics from "expo-haptics";
import { ReactNode, useMemo, useRef } from "react";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { getBarIndexFromX } from "./analytics-bar-chart";

const ACTIVE_OFFSET = 10;

export const ChartTouchOverlay = ({
  barWidth,
  spacing,
  dataLength,
  onBarSelect,
  height,
  children,
}: {
  barWidth: number;
  spacing: number;
  dataLength: number;
  onBarSelect: (index: number) => void;
  height: number;
  children: ReactNode;
}) => {
  const lastIndexRef = useRef<number | null>(null);

  const tap = useMemo(
    () =>
      Gesture.Tap()
        .runOnJS(true)
        .onEnd((event) => {
          const index = getBarIndexFromX(event.x, barWidth, spacing, dataLength);
          if (index !== null) {
            Haptics.selectionAsync();
            onBarSelect(index);
          }
        }),
    [barWidth, spacing, dataLength, onBarSelect],
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .activeOffsetX([-ACTIVE_OFFSET, ACTIVE_OFFSET])
        .failOffsetY([-ACTIVE_OFFSET, ACTIVE_OFFSET])
        .onStart((event) => {
          const index = getBarIndexFromX(event.x, barWidth, spacing, dataLength);
          if (index !== null) {
            lastIndexRef.current = index;
            Haptics.selectionAsync();
            onBarSelect(index);
          }
        })
        .onUpdate((event) => {
          const index = getBarIndexFromX(event.x, barWidth, spacing, dataLength);
          if (index !== null && index !== lastIndexRef.current) {
            lastIndexRef.current = index;
            Haptics.selectionAsync();
            onBarSelect(index);
          }
        })
        .onFinalize(() => {
          lastIndexRef.current = null;
        }),
    [barWidth, spacing, dataLength, onBarSelect],
  );

  const composed = useMemo(() => Gesture.Race(pan, tap), [pan, tap]);

  return (
    <View style={{ position: "relative" }}>
      {children}
      <GestureDetector gesture={composed}>
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height,
          }}
        />
      </GestureDetector>
    </View>
  );
};
