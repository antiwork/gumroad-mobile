import { env } from "@/lib/env";

const gumroadOrigin = new URL(env.EXPO_PUBLIC_GUMROAD_URL).origin;

const nativeSettingsScreens: Record<string, string> = {
  "/settings/payments": "/settings/payments",
};

export const nativeScreenForWebViewUrl = (url: string) => {
  try {
    const { origin, pathname } = new URL(url);
    if (origin !== gumroadOrigin) return null;
    const normalized = pathname.replace(/\/+$/, "") || "/";
    return nativeSettingsScreens[normalized] ?? null;
  } catch {
    return null;
  }
};

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
