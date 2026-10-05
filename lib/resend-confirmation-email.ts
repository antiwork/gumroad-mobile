import { RequestError, requestAPI } from "@/lib/request";

const DEFAULT_RETRY_AFTER_SECONDS = 60;
const THROTTLED_STATUS = 429;

export type ResendConfirmationResult =
  | { status: "sent" }
  | { status: "already_confirmed" }
  | { status: "throttled"; retryAfterSeconds: number };

export const resendConfirmationEmail = async (accessToken: string): Promise<ResendConfirmationResult> => {
  try {
    const response = await requestAPI<{ status: "sent" | "already_confirmed" }>(
      "mobile/sessions/resend_confirmation_email",
      { accessToken, method: "POST" },
    );
    return { status: response.status === "already_confirmed" ? "already_confirmed" : "sent" };
  } catch (error) {
    if (error instanceof RequestError && error.statusCode === THROTTLED_STATUS) {
      return { status: "throttled", retryAfterSeconds: error.retryAfterSeconds ?? DEFAULT_RETRY_AFTER_SECONDS };
    }
    throw error;
  }
};
