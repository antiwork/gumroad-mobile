import { env } from "@/lib/env";

const gumroadOrigin = new URL(env.EXPO_PUBLIC_GUMROAD_URL).origin;

export type NativeSettingsRoute = "/settings/payments" | "/settings/profile";

// Settings pages the app renders natively own their header and save button, so a WebView that
// loads them in place leaves the seller with no way to save.
const nativeSettingsRoutes: Record<string, NativeSettingsRoute | undefined> = {
  "/settings/payments": "/settings/payments",
  "/settings/profile": "/settings/profile",
};

export const getNativeSettingsRoute = (url: string): NativeSettingsRoute | null => {
  try {
    const parsed = new URL(url);
    if (parsed.origin !== gumroadOrigin) return null;
    return nativeSettingsRoutes[parsed.pathname] ?? null;
  } catch {
    return null;
  }
};