import { env } from "@/lib/env";

const gumroadOrigin = new URL(env.EXPO_PUBLIC_GUMROAD_URL).origin;

const nativeSettingsScreens: Record<string, string> = {
  "/settings/payments": "/settings/payments",
};

const gumroadPathname = (url: string) => {
  try {
    const { origin, pathname } = new URL(url);
    return origin === gumroadOrigin ? pathname.replace(/\/+$/, "") || "/" : null;
  } catch {
    return null;
  }
};

export const nativeScreenForWebViewUrl = (url: string) => {
  const normalized = gumroadPathname(url);
  return normalized === null ? null : (nativeSettingsScreens[normalized] ?? null);
};

// The player page for a purchase's build. A build is a game: it wants the whole display and
// landscape, which the portrait-locked content WebView cannot give it, so the app opens the page in
// its own screen.
export const isWebBuildPlayerUrl = (url: string, token: string) => gumroadPathname(url) === `/d/${token}/play`;

// The player page's own "Back to content" link, which closes the app's player instead of loading the
// content page inside it.
export const isWebBuildContentPageUrl = (url: string, token: string) => gumroadPathname(url) === `/d/${token}`;

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
