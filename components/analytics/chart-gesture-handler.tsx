import { ReactNode, useCallback } from "react";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

interface ChartGestureHandlerProps {
  children: ReactNode;
  dataLength: number;
  barWidth: number;
  spacing: number;
  initialSpacing?: number;
  onSelectIndex: (index: number) => void;
}

export const ChartGestureHandler = ({
  children,
  dataLength,
  barWidth,
  spacing,
  initialSpacing = 0,
  onSelectIndex,
}: ChartGestureHandlerProps) => {
  const getIndexFromX = useCallback(
    (x: number) => {
      const adjustedX = x - initialSpacing;
      const cellWidth = barWidth + spacing;
      if (cellWidth <= 0 || dataLength <= 0) return null;
      const index = Math.floor(adjustedX / cellWidth);
      if (index < 0) return 0;
      if (index >= dataLength) return dataLength - 1;
      return index;
    },
    [barWidth, spacing, initialSpacing, dataLength],
  );

  const handleTouch = useCallback(
    (x: number) => {
      const index = getIndexFromX(x);
      if (index !== null) {
        onSelectIndex(index);
      }
    },
    [getIndexFromX, onSelectIndex],
  );

  const tap = Gesture.Tap().onEnd((e) => {
    handleTouch(e.x);
  });

  const pan = Gesture.Pan()
    .onStart((e) => {
      handleTouch(e.x);
    })
    .onChange((e) => {
      handleTouch(e.x);
    });

  const gesture = Gesture.Race(pan, tap);

  return (
    <GestureDetector gesture={gesture}>
      <View>{children}</View>
    </GestureDetector>
  );
};
