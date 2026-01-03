import { Link } from "expo-router";
import { Text, View } from "react-native";
import { styled } from "react-native-css";

const StyledLink = styled(Link, { className: "style" });

export default function Index() {
  return (
    <View className="flex-1 items-center justify-center bg-[#25292e]">
      <Text className="text-white">Home screen</Text>
      <StyledLink href="/about" className="text-2xl text-white underline">
        Go to About screen
      </StyledLink>
    </View>
  );
}
