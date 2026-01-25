import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { View } from "react-native";

export default function Dashboard() {
  return (
    <Screen>
      <View className="flex-1 items-center justify-center">
        <Text className="text-lg text-muted">Dashboard coming soon</Text>
      </View>
    </Screen>
  );
}
