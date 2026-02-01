import { assertDefined } from "@/lib/assert";
import { env } from "@/lib/env";
import { request } from "@/lib/request";
import * as AuthSession from "expo-auth-session";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";

const authorizationEndpoint = `${env.EXPO_PUBLIC_GUMROAD_URL}/oauth/authorize`;
const tokenEndpoint = `${env.EXPO_PUBLIC_GUMROAD_URL}/oauth/token`;
const productsEndpoint = `${env.EXPO_PUBLIC_GUMROAD_API_URL}/mobile/analytics/products.json?mobile_token=${env.EXPO_PUBLIC_MOBILE_TOKEN}`;
const scopes = ["mobile_api", "creator_api"];

const accessTokenKey = "gumroad_access_token";
const refreshTokenKey = "gumroad_refresh_token";

WebBrowser.maybeCompleteAuthSession();

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  isCreator: boolean;
  accessToken: string | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface ProductsResponse {
  products: { id: string }[];
}

const fetchCreatorStatus = async (token: string): Promise<boolean> => {
  try {
    const response = await request<ProductsResponse>(productsEndpoint, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return (response.products?.length ?? 0) > 0;
  } catch (e) {
    console.error(e);
    return false;
  }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isCreator, setIsCreator] = useState(false);
  const router = useRouter();

  const redirectUri = AuthSession.makeRedirectUri({ scheme: "gumroadmobile" });

  const [authRequest, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: env.EXPO_PUBLIC_GUMROAD_CLIENT_ID,
      scopes,
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
    },
    {
      authorizationEndpoint,
      tokenEndpoint,
    },
  );

  useEffect(() => {
    async function loadStoredAuth() {
      try {
        const storedToken = await SecureStore.getItemAsync(accessTokenKey);
        if (storedToken) {
          setAccessToken(storedToken);
          const creatorStatus = await fetchCreatorStatus(storedToken);
          setIsCreator(creatorStatus);
        }
      } catch (error) {
        console.error("Failed to load stored auth:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadStoredAuth();
  }, []);

  const storeTokens = useCallback(async (accessToken: string, refreshToken?: string) => {
    await SecureStore.setItemAsync(accessTokenKey, accessToken);
    if (refreshToken) await SecureStore.setItemAsync(refreshTokenKey, refreshToken);
    setAccessToken(accessToken);
  }, []);

  useEffect(() => {
    async function handleAuthResponse() {
      if (response?.type === "success" && response.params.code && authRequest?.codeVerifier) {
        try {
          setIsLoading(true);
          const tokenResponse = await request<{ access_token: string; refresh_token?: string }>(tokenEndpoint, {
            method: "POST",
            data: {
              grant_type: "authorization_code",
              code: response.params.code,
              redirect_uri: redirectUri,
              client_id: env.EXPO_PUBLIC_GUMROAD_CLIENT_ID,
              code_verifier: authRequest.codeVerifier,
            },
          });
          await storeTokens(tokenResponse.access_token, tokenResponse.refresh_token);
          const creatorStatus = await fetchCreatorStatus(tokenResponse.access_token);
          setIsCreator(creatorStatus);
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
  }, [response, redirectUri, authRequest?.codeVerifier, storeTokens]);

  const login = useCallback(async () => {
    if (authRequest) await promptAsync();
  }, [authRequest, promptAsync]);

  const logout = useCallback(async () => {
    try {
      setIsLoading(true);
      await SecureStore.deleteItemAsync(accessTokenKey);
      await SecureStore.deleteItemAsync(refreshTokenKey);
      setAccessToken(null);
      setIsCreator(false);
      router.replace("/login");
    } catch (error) {
      console.error("Failed to logout:", error);
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  const refreshTokenFn = useCallback(async () => {
    try {
      const storedRefreshToken = await SecureStore.getItemAsync(refreshTokenKey);
      if (!storedRefreshToken) throw new Error("No refresh token available");

      const tokenResponse = await request<{ access_token: string; refresh_token?: string }>(tokenEndpoint, {
        method: "POST",
        data: {
          grant_type: "refresh_token",
          refresh_token: storedRefreshToken,
          client_id: env.EXPO_PUBLIC_GUMROAD_CLIENT_ID,
        },
      });
      await storeTokens(tokenResponse.access_token, tokenResponse.refresh_token);
    } catch (error) {
      console.error("Failed to refresh token:", error);
      // If refresh fails, log the user out
      await logout();
    }
  }, [logout, storeTokens]);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: !!accessToken,
        isLoading,
        isCreator,
        accessToken,
        login,
        logout,
        refreshToken: refreshTokenFn,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => assertDefined(useContext(AuthContext));
