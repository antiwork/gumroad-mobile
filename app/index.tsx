import { ForceUpdateScreen } from "@/components/force-update-screen";
import { useMinimumVersion } from "@/components/use-minimum-version";
import { useAuth } from "@/lib/auth-context";
import { Redirect } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";

SplashScreen.preventAutoHideAsync();

export default function Index() {
  const { isLoading, isCreator } = useAuth();
  const { updateRequirement, isChecking } = useMinimumVersion();

  useEffect(() => {
    if (!isLoading && !isChecking) {
      SplashScreen.hideAsync();
    }
  }, [isLoading, isChecking]);

  if (isLoading || isChecking) {
    return null;
  }

  if (updateRequirement) {
    return <ForceUpdateScreen requirement={updateRequirement} />;
  }

  return <Redirect href={isCreator ? "/(tabs)/dashboard" : "/(tabs)/library"} />;
}
