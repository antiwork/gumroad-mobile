import { createContext, useCallback, useContext, useState } from "react";
import { Dimensions, Pressable, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";
import { useCSSVariable } from "uniwind";

const SCREEN_WIDTH = Dimensions.get("window").width;
const SHEET_WIDTH = Math.min(320, SCREEN_WIDTH * 0.85);

interface SheetState {
  content: React.ReactNode | null;
  visible: boolean;
}

interface RightSheetContextType {
  openSheet: (content: React.ReactNode) => void;
  closeSheet: () => void;
}

const RightSheetContext = createContext<RightSheetContextType | null>(null);

export const useRightSheet = () => {
  const context = useContext(RightSheetContext);
  if (!context) {
    throw new Error("useRightSheet must be used within a RightSheetProvider");
  }
  return context;
};

export const RightSheetProvider = ({ children }: { children: React.ReactNode }) => {
  const [sheet, setSheet] = useState<SheetState>({ content: null, visible: false });
  const translateX = useSharedValue(SHEET_WIDTH);
  const backdropOpacity = useSharedValue(0);
  const backgroundColor = useCSSVariable("--color-background") as string;
  const insets = useSafeAreaInsets();

  const openSheet = useCallback(
    (content: React.ReactNode) => {
      setSheet({ content, visible: true });
      translateX.value = withTiming(0, { duration: 250 });
      backdropOpacity.value = withTiming(0.5, { duration: 250 });
    },
    [translateX, backdropOpacity],
  );

  const closeSheet = useCallback(() => {
    translateX.value = withTiming(SHEET_WIDTH, { duration: 200 });
    backdropOpacity.value = withTiming(0, { duration: 200 });
    setTimeout(() => {
      setSheet({ content: null, visible: false });
    }, 200);
  }, [translateX, backdropOpacity]);

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (event.translationX > 0) {
        translateX.value = event.translationX;
      }
    })
    .onEnd((event) => {
      if (event.translationX > SHEET_WIDTH * 0.3 || event.velocityX > 500) {
        translateX.value = withTiming(SHEET_WIDTH, { duration: 200 });
        backdropOpacity.value = withTiming(0, { duration: 200 });
        scheduleOnRN(closeSheet);
      } else {
        translateX.value = withTiming(0, { duration: 200 });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  return (
    <RightSheetContext.Provider value={{ openSheet, closeSheet }}>
      {children}
      {sheet.visible && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
            <Pressable style={[StyleSheet.absoluteFill, styles.backdrop]} onPress={closeSheet} />
          </Animated.View>
          <GestureDetector gesture={panGesture}>
            <Animated.View
              style={[
                styles.sheet,
                sheetStyle,
                { backgroundColor, paddingTop: insets.top, paddingBottom: insets.bottom },
              ]}
            >
              {sheet.content}
            </Animated.View>
          </GestureDetector>
        </View>
      )}
    </RightSheetContext.Provider>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: "#000",
  },
  sheet: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: SHEET_WIDTH,
    shadowColor: "#000",
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
});
