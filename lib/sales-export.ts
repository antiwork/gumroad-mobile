import { env } from "@/lib/env";
import { buildAuthenticatedWebViewUrl } from "@/lib/webview-url";

export const getExportAllSalesUrl = (accessToken?: string | null) => {
  if (accessToken) return buildAuthenticatedWebViewUrl("/purchases/export", accessToken);
  return new URL("/purchases/export", env.EXPO_PUBLIC_GUMROAD_URL).toString();
};
