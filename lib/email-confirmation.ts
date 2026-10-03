const EMAIL_UNCONFIRMED_STATUS = 403;
const EMAIL_UNCONFIRMED_MESSAGE = /confirm your email/i;

export const isEmailUnconfirmedError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  const { statusCode, serverMessage } = error as { statusCode?: unknown; serverMessage?: unknown };
  return (
    statusCode === EMAIL_UNCONFIRMED_STATUS &&
    typeof serverMessage === "string" &&
    EMAIL_UNCONFIRMED_MESSAGE.test(serverMessage)
  );
};

const TANSTACK_DEFAULT_RETRY_COUNT = 3;

export const shouldRetry = (
  defaultRetry: boolean | number | ((failureCount: number, error: Error) => boolean) | undefined,
  failureCount: number,
  error: Error,
): boolean => {
  if (typeof defaultRetry === "function") return defaultRetry(failureCount, error);
  if (typeof defaultRetry === "boolean") return defaultRetry;
  return failureCount < (defaultRetry ?? TANSTACK_DEFAULT_RETRY_COUNT);
};
