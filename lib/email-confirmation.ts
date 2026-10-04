import { RequestError, requestAPI } from "@/lib/request";

// A 403 from the mobile purchases endpoints means the account's email is unconfirmed
// (`Api::Mobile::PurchasesController#require_confirmed_user`); every other refusal is a 401
// handled by the auth-refresh path.
export const isUnconfirmedEmailError = (error: unknown): boolean =>
  error instanceof RequestError && error.statusCode === 403;

export const UNCONFIRMED_EMAIL_MESSAGE =
  "Please confirm your email address to see your library. We sent a confirmation link to your inbox.";

export type ResendConfirmationResult = "sent" | "already_confirmed" | "throttled";

// A 429 is the server's throttle window, a normal outcome for a double-tap rather than a failure.
export const resendConfirmationEmail = async (accessToken: string): Promise<ResendConfirmationResult> => {
  try {
    const response = await requestAPI<{ status?: string }>("mobile/sessions/resend_confirmation_email", {
      accessToken,
      method: "POST",
    });
    return response.status === "already_confirmed" ? "already_confirmed" : "sent";
  } catch (error) {
    if (error instanceof RequestError && error.statusCode === 429) return "throttled";
    throw error;
  }
};
