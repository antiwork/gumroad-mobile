import { ReactNode, useCallback } from "react";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

interface InteractiveChartProps {
  children: ReactNode;
  barWidth: number;
  spacing: number;
  dataLength: number;
  onBarSelect: (index: number) => void;
}

export const InteractiveChart = ({
  children,
  barWidth,
  spacing,
  dataLength,
  onBarSelect,
}: InteractiveChartProps) => {
  const getBarIndex = useCallback(
    (x: number): number | null => {
      if (dataLength === 0) return null;
      const totalBarWidth = barWidth + spacing;
      const index = Math.floor(x / totalBarWidth);
      if (index < 0 || index >= dataLength) return null;
      return index;
    },
    [barWidth, spacing, dataLength],
  );

  const tap = Gesture.Tap().onEnd((event) => {
    const index = getBarIndex(event.x);
    if (index !== null) {
      onBarSelect(index);
    }
  });

  const pan = Gesture.Pan()
    .onUpdate((event) => {
      const index = getBarIndex(event.x);
      if (index !== null) {
        onBarSelect(index);
      }
    })
    .activeOffsetX([-5, 5]);

  const gesture = Gesture.Race(pan, tap);

  return (
    <GestureDetector gesture={gesture}>
      <View className="mt-4">{children}</View>
    </GestureDetector>
  );
};
