import { consumeNotificationRoute, markIndexInitialRoutingComplete } from "@/components/use-push-notifications";
import { useAuth } from "@/lib/auth-context";
import * as Sentry from "@sentry/react-native";
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
    let cancelled = false;

    // Defer navigation to the next frame so react-native-screens can finish
    // registering its onTransitionProgress Animated.event on the current screen.
    // Without this, on low-end Android devices the NativeAnimatedModule may try
    // to add events to a view that has already been removed from the Fabric tree,
    // causing: "addAnimatedEventToView: Animated node with tag [N] does not exist"
    const id = requestAnimationFrame(async () => {
      if (cancelled) return;
      if (!isAuthenticated) {
        router.replace("/login");
        markIndexInitialRoutingComplete();
        return;
      }
      const defaultRoute = isCreator ? "/(tabs)/agent" : "/(tabs)/library";
      let notificationRoute: string | null = null;
      try {
        const response = await Notifications.getLastNotificationResponseAsync();
        if (cancelled) return;
        notificationRoute = consumeNotificationRoute(response);
        Sentry.addBreadcrumb?.({
          category: "notifications",
          level: "info",
          message: "Cold-start notification routing",
          data: { hasResponse: response != null, route: notificationRoute },
        });
      } catch (error) {
        Sentry.captureException(error);
      }
      if (cancelled) return;
      if (notificationRoute) {
        router.replace(defaultRoute);
        router.push(notificationRoute as any);
        Notifications.clearLastNotificationResponseAsync().catch(() => {});
      } else {
        router.replace(defaultRoute);
      }
      markIndexInitialRoutingComplete();
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, [isLoading, isAuthenticated, isCreator, router]);

  return null;
}
