import { env } from "@/lib/env";

export const buildAuthenticatedWebViewUrl = (
  path: string,
  accessToken: string,
  params: Record<string, string> = {},
) => {
  const url = new URL(path, env.EXPO_PUBLIC_GUMROAD_URL);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  url.searchParams.set("access_token", accessToken);
  url.searchParams.set("mobile_token", env.EXPO_PUBLIC_MOBILE_TOKEN);
  return url.toString();
};
