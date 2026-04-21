import { Text } from "@/components/ui/text";
import { View } from "react-native";

export const StatCard = ({ label, value, testID }: { label: string; value: string; testID?: string }) => (
  <View className="flex-1 rounded-xl border border-border bg-card px-3 py-2" testID={testID}>
    <Text className="text-xs text-muted">{label}</Text>
    <Text className="text-lg font-bold">{value}</Text>
  </View>
);
