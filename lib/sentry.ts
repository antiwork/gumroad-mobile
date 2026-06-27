import * as Sentry from "@sentry/react-native";
import type { ErrorEvent } from "@sentry/core";
import { env } from "@/lib/env";

export const navigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: true,
});

// Drop transient, non-actionable failures that flood Sentry as handled
// exceptions (issue 7336845703): flaky-network downloads, FCM token hiccups,
// declined notification permissions. Scan every value since the signal is often
// in a chained `Caused by:` cause, and keep HTTP-status failures like
// "response has status 404" — those are real bugs.
const NON_ACTIONABLE_MARKERS = [
  "The network connection was lost.",
  "The request timed out.",
  "The Internet connection appears to be offline.",
  "Could not connect to the server.",
  "A server with the specified hostname could not be found.",
  "SocketTimeoutException",
  "SocketException",
  "UnknownHostException",
  "ConnectException",
  "ConnectionShutdownException",
  "StreamResetException",
  "Unable to download asset from url:",
  "Fetching the token failed",
  "SERVICE_NOT_AVAILABLE",
  "Notifications are not allowed for this application",
  "Network request failed",
  "User interaction is not allowed",
];

const isNonActionableError = (event: ErrorEvent) =>
  event.exception?.values?.some((value) => {
    if (value.type === "AbortError") return true;
    const text = `${value.type ?? ""}: ${value.value ?? ""}`;
    return NON_ACTIONABLE_MARKERS.some((marker) => text.includes(marker));
  }) ?? false;

Sentry.init({
  dsn: env.EXPO_PUBLIC_SENTRY_DSN,
  tracesSampleRate: __DEV__ ? 1 : 0.1,
  // Reduce from default 100 to 30 to prevent main-thread hangs.
  // SentryCrashScopeObserver serializes all breadcrumbs to JSON on the main
  // thread via addEscapedString, which blocks for 2000ms+ with 100 breadcrumbs.
  // See: https://gumroad-to.sentry.io/issues/7435371854/
  maxBreadcrumbs: 30,
  // Session replay disabled: the native SentrySessionReplay.createAndCaptureInBackground
  // method blocks the main thread for 2000ms+, causing app hangs on iOS.
  // See: https://github.com/getsentry/sentry-react-native/issues/4838
  // Re-enable once the upstream fix lands in @sentry/react-native.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  beforeSend(event) {
    if (isNonActionableError(event)) {
      return null;
    }
    return event;
  },
  integrations: [navigationIntegration],
});

export { Sentry };
