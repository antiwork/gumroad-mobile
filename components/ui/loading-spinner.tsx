import rainbowSvg from "@/assets/images/loading-rainbow.svg";
import { Image } from "expo-image";
import { useEffect } from "react";
import { View, ViewProps } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

const AnimatedImage = Animated.createAnimatedComponent(Image);

type LoadingSpinnerProps = ViewProps & {
  size?: "small" | "large";
};

export const LoadingSpinner = ({ size = "large", ...props }: LoadingSpinnerProps) => {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(withTiming(360, { duration: 1000, easing: Easing.linear }), -1, false);
  }, [rotation]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const dimension = size === "large" ? 48 : 24;

  return (
    <View {...props}>
      <AnimatedImage
        source={rainbowSvg}
        style={[{ width: dimension, height: dimension }, animatedStyle]}
        contentFit="contain"
      />
    </View>
  );
};
