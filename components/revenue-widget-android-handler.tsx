"use no memo";

import { buildApiUrl, request } from "@/lib/request";
import * as SecureStore from "expo-secure-store";
import { registerWidgetTaskHandler, type WidgetTaskHandlerProps } from "react-native-android-widget";
import { RevenueWidgetAndroid } from "./revenue-widget-android";

interface RevenueTotalsResponse {
  day: { formatted_revenue: string };
  week: { formatted_revenue: string };
  month: { formatted_revenue: string };
  year: { formatted_revenue: string };
}

const renderRevenueWidget = async () => {
  const accessToken = await SecureStore.getItemAsync("gumroad_access_token");

  if (!accessToken) {
    return <RevenueWidgetAndroid today="" week="" month="" year="" isLoggedIn={false} hasError={false} />;
  }

  try {
    const url = buildApiUrl("mobile/analytics/revenue_totals.json");
    const data = await request<RevenueTotalsResponse>(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    return (
      <RevenueWidgetAndroid
        today={data.day.formatted_revenue}
        week={data.week.formatted_revenue}
        month={data.month.formatted_revenue}
        year={data.year.formatted_revenue}
        isLoggedIn={true}
        hasError={false}
      />
    );
  } catch {
    return <RevenueWidgetAndroid today="" week="" month="" year="" isLoggedIn={true} hasError={true} />;
  }
};

registerWidgetTaskHandler(async (props: WidgetTaskHandlerProps) => {
  switch (props.widgetAction) {
    case "WIDGET_ADDED":
    case "WIDGET_UPDATE":
    case "WIDGET_RESIZED":
      props.renderWidget(await renderRevenueWidget());
      break;
    case "WIDGET_DELETED":
      break;
    case "WIDGET_CLICK":
      break;
  }
});
