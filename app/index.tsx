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

// Cap the first-launch sales lookup so a slow network can never blank the
// cold start — fall back to the static creator default instead.
const FIRST_LAUNCH_CHECK_TIMEOUT_MS = 3_000;

const withTimeout = <T,>(promise: Promise<T>, ms: number, fallback: T): Promise<T> =>
  Promise.race([promise, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))]);

// First launch only (no saved tab yet): creators who have made sales land on
// Analytics, everyone else lands on Library. Every subsequent launch restores
// whichever tab the user last used (saved in lib/tab-preference).
const resolveFirstLaunchRoute = async (isCreator: boolean, accessToken: string | null): Promise<TabRoute> => {
  if (!isCreator) return "/(tabs)/library";
  if (!accessToken) return "/(tabs)/analytics";
  try {
    const response = await withTimeout(
      requestAPI<{ success: boolean; sales_count: number }>(buildSalesAnalyticsPath("year", new Date().toISOString()), {
        accessToken,
      }),
      FIRST_LAUNCH_CHECK_TIMEOUT_MS,
      { success: true, sales_count: 1 }, // timed out — assume sales; Analytics is the safer creator default
    );
    return response.success && response.sales_count === 0 ? "/(tabs)/library" : "/(tabs)/analytics";
  } catch {
    // Can't tell (offline, API error) — Analytics is the safer creator default.
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

      // Read the notification response FIRST: a user who tapped a notification
      // should never wait on the first-launch sales lookup.
      let notificationResponse: Notifications.NotificationResponse | null = null;
      try {
        notificationResponse = await Notifications.getLastNotificationResponseAsync();
      } catch (error) {
        Sentry.captureException(error);
      }
      if (cancelled) return;

      const savedTab = await getSavedTab();
      if (cancelled) return;

      // Guard against restoring a tab that is hidden for this user: agent and
      // analytics are creator-only (href: null otherwise), so a non-creator —
      // including a creator whose status check failed offline — goes to Library.
      const effectiveSavedTab: TabName | null = savedTab && !isCreator && savedTab !== "library" ? null : savedTab;

      let defaultRoute: TabRoute;
      if (effectiveSavedTab) {
        defaultRoute = `/(tabs)/${effectiveSavedTab}`;
      } else if (notificationResponse) {
        // Launched from a notification tap with no saved tab: skip the network
        // lookup entirely — the back target just needs to be a valid tab.
        defaultRoute = isCreator ? "/(tabs)/analytics" : "/(tabs)/library";
      } else {
        defaultRoute = await resolveFirstLaunchRoute(isCreator, accessToken);
      }
      if (cancelled) return;

      // Consume (and thereby dedupe) the notification only after the last
      // cancellation check, so a cancelled effect run can't swallow the tap.
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
  }, [isLoading, isAuthenticated, isCreator, accessToken, router]);

  return null;
}
