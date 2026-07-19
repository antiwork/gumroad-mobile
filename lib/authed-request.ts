import { assertDefined } from "@/lib/assert";
import { useAuth } from "@/lib/auth-context";
import { KeychainUnavailableError, SessionExpiredError, UnauthorizedError } from "@/lib/request";
import * as Sentry from "@sentry/react-native";

export const useAuthedRequest = () => {
  const { accessToken, refreshToken, logout } = useAuth();

  return async <T>(run: (token: string) => Promise<T>): Promise<T> => {
    try {
      return await run(assertDefined(accessToken));
    } catch (error) {
      if (!(error instanceof UnauthorizedError)) throw error;
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
      return await run(newToken);
    }
  };
};
