import { consumeNotificationRoute, markIndexInitialRoutingComplete } from "@/components/use-push-notifications";
import { buildSalesAnalyticsPath } from "@/components/dashboard/use-sales-analytics";
import { useAuth } from "@/lib/auth-context";
import { requestAPI } from "@/lib/request";
import { getSavedTab, TabName } from "@/lib/tab-preference";
import * as Sentry from "@sentry/react-native";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";

SplashScreen.preventAutoHideAsync();

type TabRoute = `/(tabs)/${TabName}`;

const FIRST_LAUNCH_CHECK_TIMEOUT_MS = 3_000;

const resolveFirstLaunchRoute = async (accessToken: string | null): Promise<TabRoute> => {
  if (!accessToken) return "/(tabs)/dashboard";
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FIRST_LAUNCH_CHECK_TIMEOUT_MS);
  try {
    const response = await requestAPI<{ success: boolean; sales_count: number }>(
      buildSalesAnalyticsPath("year", new Date().toISOString()),
      { accessToken, signal: controller.signal },
    );
    return response.success && response.sales_count === 0 ? "/(tabs)/dashboard" : "/(tabs)/analytics";
  } catch {
    return "/(tabs)/dashboard";
  } finally {
    clearTimeout(timeoutId);
  }
};

export default function Index() {
  const { isLoading, isAuthenticated, accessToken } = useAuth();
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

      let notificationResponse: Notifications.NotificationResponse | null = null;
      try {
        notificationResponse = await Notifications.getLastNotificationResponseAsync();
      } catch (error) {
        Sentry.captureException(error);
      }
      if (cancelled) return;

      const screenshotRoute = "SCREENSHOT_ROUTE_VALUE" as string;
      if (screenshotRoute !== "SCREENSHOT_ROUTE_PLACEHOLDER") {
        if (screenshotRoute.startsWith("/edit-product")) {
          router.replace({ pathname: "/edit-product", params: { permalink: "gywzrt", name: "iOS QA Pack" } });
        } else {
          router.replace(screenshotRoute as TabRoute);
        }
        markIndexInitialRoutingComplete();
        return;
      }

      const savedTab = await getSavedTab();
      if (cancelled) return;

      let defaultRoute: TabRoute;
      if (savedTab) {
        defaultRoute = `/(tabs)/${savedTab}`;
      } else if (notificationResponse) {
        defaultRoute = "/(tabs)/dashboard";
      } else {
        defaultRoute = await resolveFirstLaunchRoute(accessToken);
      }
      if (cancelled) return;

      const notificationRoute = consumeNotificationRoute(notificationResponse);
      Sentry.addBreadcrumb?.({
        category: "notifications",
        level: "info",
        message: "Cold-start notification routing",
        data: { hasResponse: notificationResponse != null, route: notificationRoute },
      });
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
  }, [isLoading, isAuthenticated, accessToken, router]);

  return null;
}
