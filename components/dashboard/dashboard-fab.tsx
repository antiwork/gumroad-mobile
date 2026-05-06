import { LineIcon } from "@/components/icon";
import { useAuth } from "@/lib/auth-context";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { Pressable } from "react-native";

export const DashboardFAB = () => {
  const { isCreator } = useAuth();
  const router = useRouter();

  if (!isCreator) return null;

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        router.push("/email-compose");
      }}
      accessibilityRole="button"
      accessibilityLabel="Compose new email"
      testID="dashboard-compose-fab"
      className="absolute bottom-24 right-4 h-14 w-14 items-center justify-center rounded-full bg-accent shadow-lg shadow-black/20"
    >
      <LineIcon name="plus" size={28} className="text-accent-foreground" />
    </Pressable>
  );
};
