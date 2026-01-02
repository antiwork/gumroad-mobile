import { Link } from "expo-router";
import { Text, View } from "react-native";
import { styled } from "react-native-css";

const StyledLink = styled(Link, { className: "style" });

export default function Index() {
  return (
    <View className="flex-1 bg-[#25292e] items-center justify-center">
      <Text className="text-white">Home screen</Text>
      <StyledLink href="/about" className="text-white text-2xl underline">
        Go to About screen
      </StyledLink>
    </View>
  );
}
