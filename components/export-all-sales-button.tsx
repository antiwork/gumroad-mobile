import { LineIcon } from "@/components/icon";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import { env } from "@/lib/env";
import { safeOpenURL } from "@/lib/open-url";
import { Alert as NativeAlert } from "react-native";

export const getExportAllSalesUrl = (accessToken?: string | null) => {
  const url = new URL("/purchases/export", env.EXPO_PUBLIC_GUMROAD_URL);
  if (accessToken) {
    url.searchParams.set("access_token", accessToken);
    url.searchParams.set("mobile_token", env.EXPO_PUBLIC_MOBILE_TOKEN);
  }
  return url.toString();
};

type ExportAllSalesButtonProps = Omit<ButtonProps, "children" | "onPress">;

export const ExportAllSalesButton = (props: ExportAllSalesButtonProps) => {
  const { accessToken } = useAuth();

  const handlePress = () => {
    NativeAlert.alert(
      "Export all sales",
      "You'll get a CSV of every sale you've made. Large exports arrive by email.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Export", onPress: () => safeOpenURL(getExportAllSalesUrl(accessToken)) },
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
