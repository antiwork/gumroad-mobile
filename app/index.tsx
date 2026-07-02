import { consumeNotificationRoute, markIndexInitialRoutingComplete } from "@/components/use-push-notifications";
import { buildSalesAnalyticsPath } from "@/components/dashboard/use-sales-analytics";
import { useAuth } from "@/lib/auth-context";
import { requestAPI } from "@/lib/request";
import { getSavedTab } from "@/lib/tab-preference";
import * as Sentry from "@sentry/react-native";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";

SplashScreen.preventAutoHideAsync();

// First launch only (no saved tab yet): creators who have made sales land on
// Analytics, everyone else lands on Library. Every subsequent launch restores
// whichever tab the user last used (saved in lib/tab-preference).
const resolveFirstLaunchRoute = async (isCreator: boolean, accessToken: string | null): Promise<string> => {
  if (!isCreator) return "/(tabs)/library";
  if (!accessToken) return "/(tabs)/analytics";
  try {
    const response = await requestAPI<{ success: boolean; sales_count: number }>(
      buildSalesAnalyticsPath("year", new Date().toISOString()),
      { accessToken },
    );
    return response.sales_count > 0 ? "/(tabs)/analytics" : "/(tabs)/library";
  } catch {
    // Can't tell (offline, slow API) — Analytics is the safer creator default.
    return "/(tabs)/analytics";
  }
};

export default function Index() {
  const { isLoading, isAuthenticated, isCreator, accessToken } = useAuth();
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
      const savedTab = await getSavedTab();
      if (cancelled) return;
      const defaultRoute = savedTab ? `/(tabs)/${savedTab}` : await resolveFirstLaunchRoute(isCreator, accessToken);
      if (cancelled) return;
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
        router.replace(defaultRoute as any);
        router.push(notificationRoute as any);
        Notifications.clearLastNotificationResponseAsync().catch(() => {});
      } else {
        router.replace(defaultRoute as any);
      }
      markIndexInitialRoutingComplete();
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, [isLoading, isAuthenticated, isCreator, accessToken, router]);

  return null;
}
