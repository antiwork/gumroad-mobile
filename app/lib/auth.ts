import * as AuthSession from "expo-auth-session";
import * as SecureStore from "expo-secure-store";

const rootUrl = "https://gumroad.com";

export const GUMROAD_AUTH_CONFIG = {
  authorizationEndpoint: `${rootUrl}/oauth/authorize`,
  tokenEndpoint: `${rootUrl}/oauth/token`,
  scopes: ["mobile_api", "creator_api"],
} as const;

// Keys for secure storage
const TOKEN_KEY = "gumroad_access_token";
const REFRESH_TOKEN_KEY = "gumroad_refresh_token";

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in?: number;
  scope?: string;
}

export interface AuthConfig {
  clientId: string;
}

// Get the redirect URI based on the app scheme
export function getRedirectUri(): string {
  return AuthSession.makeRedirectUri({
    scheme: "gumroadmobile",
  });
}

// Create the discovery document for Gumroad
export function getDiscovery(): AuthSession.DiscoveryDocument {
  return {
    authorizationEndpoint: GUMROAD_AUTH_CONFIG.authorizationEndpoint,
    tokenEndpoint: GUMROAD_AUTH_CONFIG.tokenEndpoint,
  };
}

// Store tokens securely
export async function storeTokens(accessToken: string, refreshToken?: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, accessToken);
  if (refreshToken) {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
  }
}

// Get stored access token
export async function getStoredAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

// Get stored refresh token
export async function getStoredRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

// Clear stored tokens (for logout)
export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}

// Exchange authorization code for tokens using PKCE
export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
  clientId: string,
  codeVerifier: string,
): Promise<TokenResponse> {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: codeVerifier,
  });

  const response = await fetch(GUMROAD_AUTH_CONFIG.tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  return response.json();
}

// Refresh access token using refresh token
export async function refreshAccessToken(refreshToken: string, clientId: string): Promise<TokenResponse> {
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
  });

  const response = await fetch(GUMROAD_AUTH_CONFIG.tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token refresh failed: ${error}`);
  }

  return response.json();
}
