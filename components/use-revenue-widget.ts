import RevenueWidget from "@/components/revenue-widget";
import { env } from "@/lib/env";
import { buildApiUrl, request, useAPIRequest } from "@/lib/request";
import { useAuth } from "@/lib/auth-context";
import { useEffect } from "react";
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

const updateWidgetWithData = (data: RevenueTotalsResponse) => {
  RevenueWidget.updateSnapshot({
    today: data.day.formatted_revenue,
    week: data.week.formatted_revenue,
    month: data.month.formatted_revenue,
    year: data.year.formatted_revenue,
    isLoggedIn: true,
    hasError: false,
  });
};

const updateWidgetLoggedOut = () => {
  RevenueWidget.updateSnapshot({
    today: "",
    week: "",
    month: "",
    year: "",
    isLoggedIn: false,
    hasError: false,
  });
};

const updateWidgetError = () => {
  RevenueWidget.updateSnapshot({
    today: "",
    week: "",
    month: "",
    year: "",
    isLoggedIn: true,
    hasError: true,
  });
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
