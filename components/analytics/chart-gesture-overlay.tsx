import { ReactNode, useCallback, useRef, useState } from "react";
import { GestureResponderEvent, PanResponder, View } from "react-native";

export const ChartGestureOverlay = ({
  dataLength,
  barWidth,
  spacing,
  onSelectIndex,
  children,
}: {
  dataLength: number;
  barWidth: number;
  spacing: number;
  onSelectIndex: (index: number | null) => void;
  children: ReactNode;
}) => {
  const overlayRef = useRef<View>(null);
  const lastIndexRef = useRef<number | null>(null);
  const offsetXRef = useRef(0);

  const getIndexFromPageX = useCallback(
    (pageX: number) => {
      const x = pageX - offsetXRef.current;
      if (x < 0 || dataLength === 0) return null;
      const index = Math.floor(x / (barWidth + spacing));
      if (index < 0 || index >= dataLength) return null;
      return index;
    },
    [barWidth, spacing, dataLength],
  );

  const handleTouch = useCallback(
    (pageX: number) => {
      const index = getIndexFromPageX(pageX);
      if (index !== lastIndexRef.current) {
        lastIndexRef.current = index;
        onSelectIndex(index);
      }
    },
    [getIndexFromPageX, onSelectIndex],
  );

  const [panResponder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt: GestureResponderEvent) => {
        overlayRef.current?.measureInWindow((x: number) => {
          offsetXRef.current = x;
          handleTouch(evt.nativeEvent.pageX);
        });
      },
      onPanResponderMove: (evt: GestureResponderEvent) => {
        handleTouch(evt.nativeEvent.pageX);
      },
    }),
  );

  return (
    <View className="relative">
      {children}
      <View
        ref={overlayRef}
        {...panResponder.panHandlers}
        className="absolute inset-0"
        style={{ zIndex: 10 }}
      />
    </View>
  );
};
