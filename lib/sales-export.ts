import { env } from "@/lib/env";

export const getExportAllSalesUrl = (accessToken?: string | null) => {
  const url = new URL("/purchases/export", env.EXPO_PUBLIC_GUMROAD_URL);
  if (accessToken) {
    url.searchParams.set("access_token", accessToken);
    url.searchParams.set("mobile_token", env.EXPO_PUBLIC_MOBILE_TOKEN);
  }
  return url.toString();
};
