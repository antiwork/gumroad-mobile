import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import {
  clearTokens,
  exchangeCodeForTokens,
  getDiscovery,
  getRedirectUri,
  getStoredAccessToken,
  getStoredRefreshToken,
  GUMROAD_AUTH_CONFIG,
  refreshAccessToken,
  storeTokens,
} from "../lib/auth";
import { CLIENT_ID } from "../lib/authSecrets";

// Enable web browser for auth session completion
WebBrowser.maybeCompleteAuthSession();

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  accessToken: string | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const redirectUri = getRedirectUri();
  const discovery = getDiscovery();

  // Auth request configuration with PKCE
  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: CLIENT_ID,
      scopes: [...GUMROAD_AUTH_CONFIG.scopes],
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
    },
    discovery,
  );

  // Check for stored token on mount
  useEffect(() => {
    async function loadStoredAuth() {
      try {
        const storedToken = await getStoredAccessToken();
        if (storedToken) {
          setAccessToken(storedToken);
        }
      } catch (error) {
        console.error("Failed to load stored auth:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadStoredAuth();
  }, []);

  // Handle auth response
  useEffect(() => {
    async function handleAuthResponse() {
      if (response?.type === "success" && response.params.code && request?.codeVerifier) {
        try {
          setIsLoading(true);
          const tokenResponse = await exchangeCodeForTokens(
            response.params.code,
            redirectUri,
            CLIENT_ID,
            request.codeVerifier,
          );

          await storeTokens(tokenResponse.access_token, tokenResponse.refresh_token);
          setAccessToken(tokenResponse.access_token);
        } catch (error) {
          console.error("Failed to exchange code for tokens:", error);
        } finally {
          setIsLoading(false);
        }
      } else if (response?.type === "error") {
        console.error("Auth error:", response.error);
        setIsLoading(false);
      }
    }
    handleAuthResponse();
  }, [response, redirectUri, request?.codeVerifier]);

  const login = useCallback(async () => {
    if (request) {
      await promptAsync();
    }
  }, [request, promptAsync]);

  const logout = useCallback(async () => {
    try {
      setIsLoading(true);
      await clearTokens();
      setAccessToken(null);
    } catch (error) {
      console.error("Failed to logout:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshTokenFn = useCallback(async () => {
    try {
      const storedRefreshToken = await getStoredRefreshToken();
      if (!storedRefreshToken) {
        throw new Error("No refresh token available");
      }

      const tokenResponse = await refreshAccessToken(storedRefreshToken, CLIENT_ID);

      await storeTokens(tokenResponse.access_token, tokenResponse.refresh_token);
      setAccessToken(tokenResponse.access_token);
    } catch (error) {
      console.error("Failed to refresh token:", error);
      // If refresh fails, log the user out
      await logout();
    }
  }, [logout]);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: !!accessToken,
        isLoading,
        accessToken,
        login,
        logout,
        refreshToken: refreshTokenFn,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
