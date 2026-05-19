import { LineIcon } from "@/components/icon";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useRouter } from "expo-router";
import { Alert as NativeAlert } from "react-native";

export const ExportAllSalesButton = (props: Omit<ButtonProps, "children" | "onPress">) => {
  const router = useRouter();

  const handlePress = () => {
    NativeAlert.alert(
      "Export all sales",
      "You'll get a CSV of every sale you've made. Large exports arrive by email.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Export", onPress: () => router.push("/sales-export") },
      ],
    );
  };

  return (
    <Button variant="outline" onPress={handlePress} {...props}>
      <Text className="leading-none" style={{ transform: [{ translateY: 2 }] }}>
        Export all sales
      </Text>
      <LineIcon name="arrow-right-stroke" size={18} className="text-foreground" />
    </Button>
  );
};
