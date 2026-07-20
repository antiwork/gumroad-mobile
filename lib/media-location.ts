import { requestAPI, ServerError } from "@/lib/request";
import * as Sentry from "@sentry/react-native";
import { Platform } from "react-native";

type MediaLocationRequest = {
  platform: "iphone" | "android";
  url_redirect_id: string;
  product_file_id: string;
  purchase_id?: string;
  location: number;
};

// Positions under 3 seconds are treated as noise: saving them would overwrite a
// listener's real progress whenever a track restarts from the beginning (for
// example after a failed resume). End-of-track saves are always meaningful.
export const isMeaningfulLocation = (position: number, isEnd: boolean) => isEnd || position >= 3;

// A saved location at or past the end of the track means the listener already finished it.
// Seeking there starts playback at the very end and it stops immediately, which reads as
// "the track won't play" — so finished tracks restart from the beginning, matching web.
export const isResumableLocation = (
  location: number | undefined,
  contentLength: number | undefined,
): location is number => !!location && !(contentLength && location >= contentLength);

export const updateMediaLocation = async ({
  urlRedirectId,
  productFileId,
  purchaseId,
  location,
  accessToken,
}: {
  urlRedirectId: string;
  productFileId: string;
  purchaseId?: string;
  location: number;
  accessToken: string | null;
}): Promise<void> => {
  if (!accessToken) return;

  const body: MediaLocationRequest = {
    platform: Platform.OS === "ios" ? "iphone" : "android",
    url_redirect_id: urlRedirectId,
    product_file_id: productFileId,
    location,
  };

  if (purchaseId) {
    body.purchase_id = purchaseId;
  }

  try {
    await requestAPI("mobile/media_locations", { method: "POST", data: body, accessToken, skipResponseBody: true });
  } catch (error) {
    // Log but don't throw - media location sync is non-critical
    console.warn("Failed to update media location:", error);
    // AbortError (request timeout on poor connectivity) and ServerError (transient
    // backend 5xx such as Heroku 502s) are expected during periodic background sync
    // and are not actionable code bugs - no need to report to Sentry
    const isAbortError = error instanceof Error && error.name === "AbortError";
    if (!isAbortError && !(error instanceof ServerError)) {
      Sentry.captureException(error);
    }
  }
};
