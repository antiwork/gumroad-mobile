import { buildApiUrl, request, useAPIRequest } from "@/lib/request";
import { useAuth } from "@/lib/auth-context";
import { useEffect } from "react";
import { Platform } from "react-native";
import * as BackgroundFetch from "expo-background-fetch";
import * as TaskManager from "expo-task-manager";
import * as SecureStore from "expo-secure-store";

const BACKGROUND_FETCH_TASK = "revenue-widget-update";

interface RevenueTotalsResponse {
  day: { formatted_revenue: string };
  week: { formatted_revenue: string };
  month: { formatted_revenue: string };
  year: { formatted_revenue: string };
}

type WidgetData = {
  today: string;
  week: string;
  month: string;
  year: string;
  isLoggedIn: boolean;
  hasError: boolean;
};

const updateIOSWidget = async (data: WidgetData) => {
  const { default: RevenueWidget } = await import("@/components/revenue-widget");
  RevenueWidget.updateSnapshot(data);
};

const updateAndroidWidget = async (data: WidgetData) => {
  const { requestWidgetUpdate } = await import("react-native-android-widget");
  const { RevenueWidgetAndroid } = await import("@/components/revenue-widget-android");
  await requestWidgetUpdate({
    widgetName: "RevenueWidget",
    renderWidget: () => (
      <RevenueWidgetAndroid
        today={data.today}
        week={data.week}
        month={data.month}
        year={data.year}
        isLoggedIn={data.isLoggedIn}
        hasError={data.hasError}
      />
    ),
  });
};

const updateWidget = (data: WidgetData) => {
  if (Platform.OS === "ios") {
    updateIOSWidget(data);
  } else if (Platform.OS === "android") {
    updateAndroidWidget(data);
  }
};

const updateWidgetWithData = (data: RevenueTotalsResponse) => {
  updateWidget({
    today: data.day.formatted_revenue,
    week: data.week.formatted_revenue,
    month: data.month.formatted_revenue,
    year: data.year.formatted_revenue,
    isLoggedIn: true,
    hasError: false,
  });
};

const updateWidgetLoggedOut = () => {
  updateWidget({ today: "", week: "", month: "", year: "", isLoggedIn: false, hasError: false });
};

const updateWidgetError = () => {
  updateWidget({ today: "", week: "", month: "", year: "", isLoggedIn: true, hasError: true });
};

const fetchRevenueTotals = async (accessToken: string) => {
  const url = buildApiUrl("mobile/analytics/revenue_totals.json");
  return request<RevenueTotalsResponse>(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
};

TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  const accessToken = await SecureStore.getItemAsync("gumroad_access_token");
  if (!accessToken) {
    updateWidgetLoggedOut();
    return BackgroundFetch.BackgroundFetchResult.NoData;
  }

  try {
    const data = await fetchRevenueTotals(accessToken);
    updateWidgetWithData(data);
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch {
    updateWidgetError();
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

const registerBackgroundFetch = async () => {
  if (Platform.OS !== "ios") return;

  const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_FETCH_TASK);
  if (isRegistered) return;

  await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
    minimumInterval: 15 * 60,
    stopOnTerminate: false,
    startOnBoot: true,
  });
};

export const useRevenueWidget = () => {
  const { accessToken } = useAuth();

  const { data } = useAPIRequest<RevenueTotalsResponse>({
    queryKey: ["revenue_totals"],
    url: "mobile/analytics/revenue_totals.json",
    refetchInterval: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!accessToken) {
      updateWidgetLoggedOut();
      return;
    }

    if (data) {
      updateWidgetWithData(data);
    }
  }, [data, accessToken]);

  useEffect(() => {
    registerBackgroundFetch();
  }, []);
};
