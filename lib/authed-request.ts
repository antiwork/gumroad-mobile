import { assertDefined } from "@/lib/assert";
import { useAuth } from "@/lib/auth-context";
import { KeychainUnavailableError, SessionExpiredError, UnauthorizedError } from "@/lib/request";
import * as Sentry from "@sentry/react-native";

export const useAuthedRequest = () => {
  const { accessToken, refreshToken, logout, getActiveAccountId } = useAuth();

  return async <T>(run: (token: string) => Promise<T>): Promise<T> => {
    try {
      return await run(assertDefined(accessToken));
    } catch (error) {
      if (!(error instanceof UnauthorizedError)) throw error;
      const accountId = getActiveAccountId();
      let newToken: string;
      try {
        newToken = await refreshToken();
      } catch (refreshError) {
        if (refreshError instanceof KeychainUnavailableError) throw error;
        if (refreshError instanceof UnauthorizedError || refreshError instanceof SessionExpiredError) {
          console.warn(refreshError);
        } else {
          Sentry.captureException(refreshError, { tags: { auth_path: "refresh_failed" } });
        }
        await logout();
        throw error;
      }
      // A refresh that lost a revoked brand recovers the member's own account, so the new token can
      // belong to a different account than the one this request was started for. Retrying with it would
      // apply a write to the wrong account, so fail the request instead.
      if (getActiveAccountId() !== accountId) throw error;
      return await run(newToken);
    }
  };
};
