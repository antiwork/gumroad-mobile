import * as Sentry from "@sentry/react-native";

export const LIBRARY_LOAD_ENDPOINT = "mobile/purchases/search";

export const classifyLibraryLoadError = (error: unknown): string => {
  if (error instanceof Error) {
    if (error.name === "AbortError") return "abort";
    const status = (error as { statusCode?: unknown }).statusCode;
    if (typeof status === "number") return `http_${status}`;
    if (error.message.includes("Network request failed")) return "network";
  }
  return "other";
};

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
