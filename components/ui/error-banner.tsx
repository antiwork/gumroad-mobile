import { Text } from "@/components/ui/text";
import { View } from "react-native";

export const ErrorBanner = ({ error }: { error: string }) => (
  <View className="rounded-lg border border-destructive/50 bg-card px-3 py-3" testID="error-banner">
    <Text className="text-sm text-destructive">{error}</Text>
  </View>
);
