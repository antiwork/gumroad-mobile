import { Text } from "@/components/ui/text";
import { useRouter } from "expo-router";
import { TouchableOpacity } from "react-native";

export const HeaderCloseButton = () => {
  const router = useRouter();
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel="Close"
      onPress={() => router.back()}
      className="ml-3"
    >
      <Text className="font-sans text-white">Close</Text>
    </TouchableOpacity>
  );
};
