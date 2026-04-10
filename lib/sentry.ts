import * as Sentry from "@sentry/react-native";
import { env } from "@/lib/env";

export const navigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: true,
});

const mobileReplay = Sentry.mobileReplayIntegration({
  excludedViewClasses: ["ExpoVideo.VideoView"],
});

Sentry.init({
  dsn: env.EXPO_PUBLIC_SENTRY_DSN,
  tracesSampleRate: __DEV__ ? 1 : 0.1,
  replaysSessionSampleRate: __DEV__ ? 1 : 0,
  replaysOnErrorSampleRate: __DEV__ ? 1 : 0.1,
  beforeSend(event) {
    const message = event.exception?.values?.[0]?.value ?? event.exception?.values?.[0]?.type;
    if (message === "Network request failed" || message === "TypeError: Network request failed") {
      return null;
    }
    if (message?.includes("User interaction is not allowed")) {
      return null;
    }
    return event;
  },
  integrations: [navigationIntegration, mobileReplay],
});

export { Sentry };
