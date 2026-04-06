import logoDark from "@/assets/images/logo-dark.svg";
import logoLight from "@/assets/images/logo.svg";
import { StyledImage } from "@/components/styled";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useOTAUpdate } from "@/components/use-ota-update";
import { type UpdateRequirement } from "@/components/use-minimum-version";
import Constants from "expo-constants";
import { safeOpenURL } from "@/lib/open-url";
import { Platform, View } from "react-native";
import { useUniwind } from "uniwind";
import { LoadingSpinner } from "./ui/loading-spinner";

const appStoreUrl = Platform.select({
  ios: `https://apps.apple.com/app/id${Constants.expoConfig?.extra?.eas?.appleAppId ?? ""}`,
  android: `https://play.google.com/store/apps/details?id=${Constants.expoConfig?.android?.package ?? ""}`,
});

const NativeUpdateContent = () => (
  <>
    <Text className="text-center">A new version is available. Please update to continue using the app.</Text>
    <Button
      variant="accent"
      onPress={() => {
        if (appStoreUrl) safeOpenURL(appStoreUrl);
      }}
    >
      <Text>Update Now</Text>
    </Button>
  </>
);

const OTAUpdateContent = () => {
  const { isUpdateReady, apply } = useOTAUpdate();

  return isUpdateReady ? (
    <>
      <Text variant="muted" className="text-center">
        An update has been downloaded. Restart to apply it.
      </Text>
      <Button variant="accent" onPress={apply}>
        <Text>Restart</Text>
      </Button>
    </>
  ) : (
    <>
      <LoadingSpinner size="small" />
      <Text className="text-center">A required update is being downloaded. This should only take a moment.</Text>
      <Text variant="muted" className="text-center">
        If the download seems stuck, try restarting the app.
      </Text>
    </>
  );
};

export const ForceUpdateScreen = ({ requirement }: { requirement: UpdateRequirement }) => {
  const { theme } = useUniwind();

  return (
    <View className="flex-1 items-center justify-center gap-6 bg-background px-6">
      <StyledImage source={theme === "dark" ? logoDark : logoLight} className="aspect-158/22 w-50" />
      {requirement === "native" ? <NativeUpdateContent /> : <OTAUpdateContent />}
    </View>
  );
};
