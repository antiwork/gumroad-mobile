import { assertDefined } from "@/lib/assert";
import { env } from "@/lib/env";
import { request } from "@/lib/request";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";

const tokenEndpoint = `${env.EXPO_PUBLIC_GUMROAD_URL}/oauth/token`;
const productsEndpoint = `${env.EXPO_PUBLIC_GUMROAD_API_URL}/mobile/analytics/products.json?mobile_token=${env.EXPO_PUBLIC_MOBILE_TOKEN}`;
const scopes = ["mobile_api", "creator_api"];

const accessTokenKey = "gumroad_access_token";
const refreshTokenKey = "gumroad_refresh_token";

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  isCreator: boolean;
  accessToken: string | null;
  login: (email: string, password: string) => Promise<void>;
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

  const login = useCallback(
    async (email: string, password: string) => {
      setIsLoading(true);
      try {
        const response = await fetch(tokenEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            grant_type: "password",
            username: email,
            password,
            client_id: env.EXPO_PUBLIC_GUMROAD_CLIENT_ID,
            scope: scopes.join(" "),
          }),
        });
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(
            body?.error === "invalid_grant"
              ? "Invalid email or password"
              : (body?.error_description ?? "Login failed. Please try again."),
          );
        }
        const data: { access_token: string; refresh_token?: string } = await response.json();
        await storeTokens(data.access_token, data.refresh_token);
        const creatorStatus = await fetchCreatorStatus(data.access_token);
        setIsCreator(creatorStatus);
      } finally {
        setIsLoading(false);
      }
    },
    [storeTokens],
  );

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
