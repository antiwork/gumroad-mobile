import { useAuthedRequest } from "@/lib/authed-request";
import { resendConfirmationEmail } from "@/lib/resend-confirmation-email";
import { useCallback, useEffect, useState } from "react";

const SENT_COOLDOWN_SECONDS = 60;
const TICK_MS = 1_000;

type ResendState = "idle" | "sending" | "sent" | "throttled" | "failed";

export const useResendConfirmationEmail = (onAlreadyConfirmed: () => void) => {
  const authedRequest = useAuthedRequest();
  const [state, setState] = useState<ResendState>("idle");
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((seconds) => seconds - 1), TICK_MS);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const resend = useCallback(async () => {
    setState("sending");
    try {
      const result = await authedRequest(resendConfirmationEmail);
      if (result.status === "already_confirmed") {
        setState("idle");
        onAlreadyConfirmed();
      } else if (result.status === "throttled") {
        setState("throttled");
        setSecondsLeft(Math.max(1, Math.ceil(result.retryAfterSeconds)));
      } else {
        setState("sent");
        setSecondsLeft(SENT_COOLDOWN_SECONDS);
      }
    } catch {
      setState("failed");
    }
  }, [authedRequest, onAlreadyConfirmed]);

  return { resend, state, secondsLeft, isSending: state === "sending" };
};
