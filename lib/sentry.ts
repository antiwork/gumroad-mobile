import * as Sentry from "@sentry/react-native";
import type { ErrorEvent } from "@sentry/core";
import { env } from "@/lib/env";

export const navigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: true,
});

// Drop transient, non-actionable failures that flood Sentry as handled
// exceptions (issue 7336845703). Self-sufficient signals are dropped anywhere;
// generic native network errors are dropped only when a download/asset context
// co-occurs, so an actionable failure on another path with the same cause still
// reports. HTTP-status failures like "response has status 404" are kept.
const TRANSIENT_MARKERS = [
  "The network connection was lost.",
  "The request timed out.",
  "The Internet connection appears to be offline.",
  "Could not connect to the server.",
  "A server with the specified hostname could not be found.",
  "Unable to download asset from url:",
  "SERVICE_NOT_AVAILABLE",
  "Notifications are not allowed for this application",
  "Network request failed",
  "User interaction is not allowed",
];

const NATIVE_NETWORK_MARKERS = [
  "SocketTimeoutException",
  "SocketException",
  "UnknownHostException",
  "ConnectException",
  "ConnectionShutdownException",
  "StreamResetException",
];

const DOWNLOAD_CONTEXT_MARKERS = ["downloadFileAsync", "ExpoAsset.downloadAsync", "Unable to download"];

// "Unable to resolve data for blob: <uuid>" fires when iOS purges React Native's blob-backed
// response storage while the app is suspended, and something later tries to read that body.
// Reads that go through lib/request.ts are converted to StaleResponseError and retried; what
// reaches Sentry is the frameless leftover surfaced via onunhandledrejection from native code
// (no app frames, nothing to fix, the rejection is already handled by RN). Only those frameless
// leftovers are dropped — a stale-blob read that carries app stack frames points at a call site
// outside lib/request.ts and must still report. 4,771 events / 0 crashes as of 2026-07:
// https://gumroad-to.sentry.io/issues/7376092087/
const STALE_BLOB_MARKER = "Unable to resolve data for blob";

const hasAppFrames = (event: ErrorEvent) =>
  (event.exception?.values ?? []).some((value) => (value.stacktrace?.frames ?? []).some((frame) => frame.in_app));

const isNonActionableError = (event: ErrorEvent) => {
  const values = event.exception?.values;
  if (!values) return false;
  const primaryType = values[0]?.type;
  if (primaryType === "AbortError" || primaryType === "UnauthorizedError") return true;
  const text = values.map((value) => `${value.type ?? ""}: ${value.value ?? ""}`).join("\n");
  if (TRANSIENT_MARKERS.some((marker) => text.includes(marker))) return true;
  if (text.includes(STALE_BLOB_MARKER) && !hasAppFrames(event)) return true;
  return (
    DOWNLOAD_CONTEXT_MARKERS.some((marker) => text.includes(marker)) &&
    NATIVE_NETWORK_MARKERS.some((marker) => text.includes(marker))
  );
};

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
