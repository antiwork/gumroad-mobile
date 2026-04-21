import { Text } from "@/components/ui/text";
import { View } from "react-native";

export const FormField = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <View className="gap-2">
    <Text className="text-sm">{label}</Text>
    {children}
  </View>
);
