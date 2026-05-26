import { getNotificationRoute } from "@/components/use-push-notifications";
import { useAuth } from "@/lib/auth-context";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";

SplashScreen.preventAutoHideAsync();

export default function Index() {
  const { isLoading, isAuthenticated, isCreator } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync();
    }
  }, [isLoading]);

  useEffect(() => {
    if (isLoading) return;

    // Defer navigation to the next frame so react-native-screens can finish
    // registering its onTransitionProgress Animated.event on the current screen.
    // Without this, on low-end Android devices the NativeAnimatedModule may try
    // to add events to a view that has already been removed from the Fabric tree,
    // causing: "addAnimatedEventToView: Animated node with tag [N] does not exist"
    const id = requestAnimationFrame(async () => {
      if (!isAuthenticated) {
        router.replace("/login");
        return;
      }
      const defaultRoute = isCreator ? "/(tabs)/dashboard" : "/(tabs)/library";
      const response = await Notifications.getLastNotificationResponseAsync();
      const notificationRoute = getNotificationRoute(response);
      if (notificationRoute) {
        router.replace(defaultRoute);
        router.push(notificationRoute as any);
        Notifications.clearLastNotificationResponseAsync().catch(() => {});
        return;
      }
      router.replace(defaultRoute);
    });

    return () => cancelAnimationFrame(id);
  }, [isLoading, isAuthenticated, isCreator, router]);

  return null;
}
