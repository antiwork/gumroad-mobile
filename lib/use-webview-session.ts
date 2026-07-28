import { useAuth } from "@/lib/auth-context";
import { env } from "@/lib/env";
import { KeychainUnavailableError, SessionExpiredError, UnauthorizedError } from "@/lib/request";
import * as Sentry from "@sentry/react-native";
import { useCallback, useEffect, useRef, useState } from "react";

const gumroadOrigin = new URL(env.EXPO_PUBLIC_GUMROAD_URL).origin;

const isGumroadUrl = (url: string) => {
  try {
    return new URL(url).origin === gumroadOrigin;
  } catch {
    return false;
  }
};

const isLoginUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    return parsed.origin === gumroadOrigin && parsed.pathname === "/login";
  } catch {
    return false;
  }
};

export const useWebViewSession = (
  buildUrl: (accessToken: string) => string,
  { syncExternalToken = true }: { syncExternalToken?: boolean } = {},
) => {
  const { isLoading: isAuthLoading, accessToken, refreshToken, logout } = useAuth();
  const [sessionToken, setSessionToken] = useState(accessToken);
  const sessionTokenRef = useRef(accessToken);
  const observedAccessTokenRef = useRef(accessToken);
  const pendingExternalTokenRef = useRef<string | null>(null);
  const refreshStartedRef = useRef(false);
  const refreshAttemptedRef = useRef(false);

  const updateSessionToken = useCallback((token: string | null) => {
    sessionTokenRef.current = token;
    setSessionToken(token);
  }, []);

  useEffect(() => {
    if (accessToken === observedAccessTokenRef.current) return;
    observedAccessTokenRef.current = accessToken;
    if (accessToken === null) {
      pendingExternalTokenRef.current = null;
      updateSessionToken(null);
      refreshAttemptedRef.current = false;
      return;
    }
    if (accessToken === sessionTokenRef.current) return;
    if (refreshStartedRef.current) return;
    if (!syncExternalToken) {
      pendingExternalTokenRef.current = accessToken;
      return;
    }
    updateSessionToken(accessToken);
    refreshAttemptedRef.current = false;
  }, [accessToken, syncExternalToken, updateSessionToken]);

  const endSession = useCallback(
    async (error?: unknown) => {
      if (error instanceof UnauthorizedError || error instanceof SessionExpiredError) {
        console.warn(error);
      } else if (error !== undefined) {
        Sentry.captureException(error, { tags: { auth_path: "webview_refresh_failed" } });
      }
      updateSessionToken(null);
      await logout();
    },
    [logout, updateSessionToken],
  );

  const refreshSession = useCallback(() => {
    if (refreshStartedRef.current) return true;

    const pendingExternalToken = pendingExternalTokenRef.current;
    if (pendingExternalToken !== null && pendingExternalToken !== sessionTokenRef.current) {
      pendingExternalTokenRef.current = null;
      updateSessionToken(pendingExternalToken);
      refreshAttemptedRef.current = false;
      return true;
    }

    refreshStartedRef.current = true;

    if (refreshAttemptedRef.current) {
      void endSession().finally(() => {
        refreshStartedRef.current = false;
      });
      return true;
    }

    refreshAttemptedRef.current = true;
    void refreshToken()
      .then(updateSessionToken)
      .catch((error: unknown) => {
        if (error instanceof KeychainUnavailableError) {
          refreshAttemptedRef.current = false;
          return;
        }
        return endSession(error);
      })
      .finally(() => {
        refreshStartedRef.current = false;
      });
    return true;
  }, [endSession, refreshToken, updateSessionToken]);

  const handleAuthenticationNavigation = useCallback(
    (url: string) => {
      if (!isLoginUrl(url)) return false;
      return refreshSession();
    },
    [refreshSession],
  );

  const handleAuthenticationHttpError = useCallback(
    ({ statusCode, url }: { statusCode: number; url: string }) => {
      if (statusCode !== 401 || !isGumroadUrl(url)) return false;
      return refreshSession();
    },
    [refreshSession],
  );

  return {
    accessToken: sessionToken,
    handleAuthenticationHttpError,
    handleAuthenticationNavigation,
    isLoading: isAuthLoading || sessionToken === null,
    url: sessionToken === null ? null : buildUrl(sessionToken),
    webViewKey: sessionToken ?? "anonymous",
  };
};
