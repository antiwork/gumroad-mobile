import { cn } from "@/lib/utils";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LineIcon } from "./icon";
import { Text } from "./ui/text";
// import { useOTAUpdate } from "./use-ota-update";

export const useUpdateBannerVisible = () =>
  // const { isUpdateReady } = useOTAUpdate();
  // return isUpdateReady;
  true;

export const UpdateBanner = () => {
  // const { isUpdateReady, apply, dismiss } = useOTAUpdate();
  const { isUpdateReady, apply, dismiss } = { isUpdateReady: true, apply: async () => {}, dismiss: () => {} };
  const { top } = useSafeAreaInsets();

  if (!isUpdateReady) return null;

  return (
    <View className="bg-background p-2" style={{ paddingTop: top }}>
      <View className="flex-row items-center justify-between rounded border border-border bg-background px-4 py-2">
        <Text className="flex-1 text-sm">App update available</Text>
        <View className="flex-row items-center gap-4">
          <Pressable className={cn("rounded bg-accent px-3 py-1.5")} onPress={apply}>
            <Text className="text-sm font-medium text-accent-foreground">Restart</Text>
          </Pressable>
          <Pressable onPress={dismiss}>
            <LineIcon name="x" size={16} className="text-foreground" />
          </Pressable>
        </View>
      </View>
    </View>
  );
};
