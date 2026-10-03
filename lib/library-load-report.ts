import * as Sentry from "@sentry/react-native";

export const LIBRARY_LOAD_ENDPOINT = "mobile/purchases/search";

// gp#3224: Android buyers were stuck on the Library tab's "Couldn't load your library"
// copy with nothing on the app side to match it — the copy replaces the raw error and
// lib/sentry.ts drops AbortError outright, so a failed load left no screen trace and no
// event. Classify the failure into a small, stable set so the report groups into one
// deduped issue per reason instead of flooding, and so an abort (the 30s client timeout
// from REQUEST_TIMEOUT_MS) stays distinguishable from an HTTP status.
export const classifyLibraryLoadError = (error: unknown): string => {
  if (error instanceof Error) {
    if (error.name === "AbortError") return "abort";
    const status = (error as { statusCode?: unknown }).statusCode;
    if (typeof status === "number") return `http_${status}`;
    if (error.message.includes("Network request failed")) return "network";
  }
  return "other";
};

// Sanitized by construction: a static endpoint path, a reason tag, the elapsed milliseconds
// and the retry count. No response body, no query string, no token. `fingerprint` collapses
// every occurrence of the same reason into a single issue.
export const reportLibraryLoadFailure = (error: unknown, elapsedMs: number | null, failureCount: number): void => {
  const reason = classifyLibraryLoadError(error);
  Sentry.captureEvent({
    level: "warning",
    message: "library_load_failed",
    fingerprint: ["library_load_failed", reason],
    tags: { library_load_failed: "true", reason, endpoint: LIBRARY_LOAD_ENDPOINT },
    extra: { elapsed_ms: elapsedMs, failure_count: failureCount },
  });
};
