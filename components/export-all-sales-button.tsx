import { LineIcon } from "@/components/icon";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { env } from "@/lib/env";
import { safeOpenURL } from "@/lib/open-url";
import { Alert as NativeAlert } from "react-native";

export const getExportAllSalesUrl = () => new URL("/purchases/export", env.EXPO_PUBLIC_GUMROAD_URL).toString();

type ExportAllSalesButtonProps = Omit<ButtonProps, "children" | "onPress">;

export const ExportAllSalesButton = (props: ExportAllSalesButtonProps) => {
  const handlePress = () => {
    NativeAlert.alert(
      "Export all sales",
      "You'll get a CSV of every sale you've made. Large exports arrive by email.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Export", onPress: () => safeOpenURL(getExportAllSalesUrl()) },
      ],
    );
  };

  return (
    <Button variant="outline" onPress={handlePress} {...props}>
      <Text>Export all sales</Text>
      <LineIcon name="arrow-right-stroke" size={18} className="text-foreground" />
    </Button>
  );
};
