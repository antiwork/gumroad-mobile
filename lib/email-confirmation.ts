import { RequestError, requestAPI } from "@/lib/request";

// The mobile purchases endpoints answer 403 only when the account's email is unconfirmed
// (`Api::Mobile::PurchasesController#require_confirmed_user`, added in gumroad#8140). Every
// other way this app can be refused — a bad mobile token, a missing or expired session —
// comes back 401 and is handled by the auth-refresh path, so a 403 from the library means
// exactly one thing: the buyer has to confirm their email address.
export const isUnconfirmedEmailError = (error: unknown): boolean =>
  error instanceof RequestError && error.statusCode === 403;

export const UNCONFIRMED_EMAIL_MESSAGE =
  "Please confirm your email address to see your library. We sent a confirmation link to your inbox.";

export type ResendConfirmationResult = "sent" | "already_confirmed" | "throttled";

// `Api::Mobile::SessionsController#resend_confirmation_email`. It answers 429 with a retry
// window when the buyer asks again within the throttle, which is a normal outcome for a
// double-tap, not a failure — surface it as "throttled" instead of throwing.
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
