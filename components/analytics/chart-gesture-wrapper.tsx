import { ReactNode, useCallback, useRef } from "react";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

export const getBarIndex = (x: number, barWidth: number, spacing: number, barCount: number): number | null => {
  const barSlotWidth = barWidth + spacing;
  if (barSlotWidth <= 0 || barCount <= 0) return null;
  const index = Math.floor(x / barSlotWidth);
  if (index < 0 || index >= barCount) return null;
  return index;
};

export const ChartGestureWrapper = ({
  barCount,
  barWidth,
  spacing,
  selectedIndex,
  onSelectIndex,
  children,
}: {
  barCount: number;
  barWidth: number;
  spacing: number;
  selectedIndex: number | null;
  onSelectIndex: (index: number | null) => void;
  children: ReactNode;
}) => {
  const lastIndex = useRef<number | null>(null);
  const didScrub = useRef(false);

  const resolveIndex = useCallback(
    (x: number) => getBarIndex(x, barWidth, spacing, barCount),
    [barWidth, spacing, barCount],
  );

  const pan = Gesture.Pan()
    .onBegin((event) => {
      const index = resolveIndex(event.x);
      lastIndex.current = index;
      didScrub.current = false;
      if (index !== null) {
        onSelectIndex(index);
      }
    })
    .onUpdate((event) => {
      const index = resolveIndex(event.x);
      if (index !== null && index !== lastIndex.current) {
        didScrub.current = true;
        lastIndex.current = index;
        onSelectIndex(index);
      }
    })
    .onEnd((event) => {
      if (!didScrub.current) {
        const index = resolveIndex(event.x);
        if (index !== null && index === selectedIndex) {
          onSelectIndex(null);
        }
      }
    })
    .minDistance(0);

  return (
    <GestureDetector gesture={pan}>
      <View collapsable={false}>{children}</View>
    </GestureDetector>
  );
};
