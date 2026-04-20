import * as Sentry from "@sentry/react-native";
import { env } from "@/lib/env";

export const navigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: true,
});

Sentry.init({
  dsn: env.EXPO_PUBLIC_SENTRY_DSN,
  tracesSampleRate: __DEV__ ? 1 : 0.1,
  // Session replay disabled: the native SentrySessionReplay.createAndCaptureInBackground
  // method blocks the main thread for 2000ms+, causing app hangs on iOS.
  // See: https://github.com/getsentry/sentry-react-native/issues/4838
  // Re-enable once the upstream fix lands in @sentry/react-native.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
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
  integrations: [navigationIntegration],
});

export { Sentry };
