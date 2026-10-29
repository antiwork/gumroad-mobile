import {
  AccountsState,
  clearAccounts,
  fetchAccounts,
  findAccount,
  loadAccounts,
  mergeServerAccounts,
  profileFromApi,
  requestAccountSwitch,
  saveAccounts,
  StoredAccount,
  SwitchAccountResponse,
  withAccountTokens,
} from "@/lib/accounts";
import { assertDefined } from "@/lib/assert";
import { queryClient } from "@/lib/query-client";
import { env } from "@/lib/env";
import {
  isInvalidGrantError,
  KeychainUnavailableError,
  request,
  SessionExpiredError,
  UnauthorizedError,
} from "@/lib/request";
import { clearSavedTab } from "@/lib/tab-preference";
import * as Sentry from "@sentry/react-native";
import * as AuthSession from "expo-auth-session";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";

const authorizationEndpoint = `${env.EXPO_PUBLIC_GUMROAD_URL}/oauth/mobile_pre_authorization/new`;
const tokenEndpoint = `${env.EXPO_PUBLIC_GUMROAD_URL}/oauth/token`;
const productsEndpoint = `${env.EXPO_PUBLIC_GUMROAD_API_URL}/mobile/analytics/products.json?mobile_token=${env.EXPO_PUBLIC_MOBILE_TOKEN}`;
const scopes = ["mobile_api", "creator_api", "account"];

const accessTokenKey = "gumroad_access_token";
const refreshTokenKey = "gumroad_refresh_token";

WebBrowser.maybeCompleteAuthSession();

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  isCreator: boolean | null;
  accessToken: string | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<string>;
  refreshCreatorStatus: () => Promise<void>;
  accounts: StoredAccount[];
  activeAccountId: string | null;
  isSwitchingAccount: boolean;
  switchAccount: (accountId: string) => Promise<boolean>;
  refreshAccounts: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface ProductsResponse {
  products: { id: string }[];
}

type CreatorStatusResult = { isCreator: boolean } | { error: unknown };

const fetchCreatorStatusResult = async (token: string): Promise<CreatorStatusResult> => {
  try {
    const response = await request<ProductsResponse>(productsEndpoint, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return { isCreator: (response.products?.length ?? 0) > 0 };
  } catch (e) {
    return { error: e };
  }
};

const reportCreatorStatusError = (e: unknown) => {
  // UnauthorizedError (401) is expected here: we updated the required token
  // scopes, so older tokens may lack access to this endpoint. This is a
  // normal auth-refresh path, not a bug worth reporting to Sentry.
  if (e instanceof UnauthorizedError) {
    console.warn(e);
  } else {
    console.error(e);
    Sentry.captureException(e);
  }
};

const fetchCreatorStatus = async (token: string): Promise<boolean | null> => {
  const result = await fetchCreatorStatusResult(token);
  if ("error" in result) {
    reportCreatorStatusError(result.error);
    return null;
  }
  return result.isCreator;
};

const retryFetchCreatorStatus = async (token: string): Promise<CreatorStatusResult> => {
  const result = await fetchCreatorStatusResult(token);
  if (!("error" in result) || result.error instanceof UnauthorizedError) return result;

  return fetchCreatorStatusResult(token);
};

const secureStoreOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

const emptyAccountsState: AccountsState = { accounts: [], activeAccountId: null };

const isKeychainUnavailableError = (error: unknown): boolean =>
  error instanceof Error &&
  (error.message.includes("User interaction is not allowed") || error.message.includes("No keychain is available"));

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isCreator, setIsCreator] = useState<boolean | null>(false);
  const inflightRefresh = useRef<Promise<string> | null>(null);
  const [accountsState, setAccountsState] = useState<AccountsState>(emptyAccountsState);
  const accountsStateRef = useRef<AccountsState>(emptyAccountsState);
  const [isSwitchingAccount, setIsSwitchingAccount] = useState(false);
  const switchingRef = useRef(false);
  const router = useRouter();

  const updateAccountsState = useCallback(async (next: AccountsState) => {
    accountsStateRef.current = next;
    setAccountsState(next);
    try {
      await saveAccounts(next);
    } catch (error) {
      if (!isKeychainUnavailableError(error)) Sentry.captureException(error);
    }
  }, []);

  const refreshAccountsWithToken = useCallback(
    async (token: string) => {
      try {
        const serverAccounts = await fetchAccounts(token);
        const storedRefreshToken = await SecureStore.getItemAsync(refreshTokenKey);
        await updateAccountsState(
          mergeServerAccounts(accountsStateRef.current, serverAccounts, {
            accessToken: token,
            refreshToken: storedRefreshToken,
          }),
        );
      } catch (error) {
        console.warn("Failed to load accounts:", error);
      }
    },
    [updateAccountsState],
  );

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
          const storedAccounts = await loadAccounts().catch(() => emptyAccountsState);
          accountsStateRef.current = storedAccounts;
          setAccountsState(storedAccounts);
          const creatorStatus = await fetchCreatorStatus(storedToken);
          setIsCreator(creatorStatus);
          void refreshAccountsWithToken(storedToken);
        }
      } catch (error) {
        if (isKeychainUnavailableError(error)) {
          console.warn("Keychain unavailable (device may be locked):", error);
        } else {
          console.error("Failed to load stored auth:", error);
          Sentry.captureException(error);
        }
      } finally {
        setIsLoading(false);
      }
    }
    loadStoredAuth();
  }, [refreshAccountsWithToken]);

  const storeTokens = useCallback(async (accessToken: string, refreshToken?: string) => {
    try {
      await SecureStore.deleteItemAsync(accessTokenKey);
      await SecureStore.setItemAsync(accessTokenKey, accessToken, secureStoreOptions);
      if (refreshToken) {
        await SecureStore.deleteItemAsync(refreshTokenKey);
        await SecureStore.setItemAsync(refreshTokenKey, refreshToken, secureStoreOptions);
      }
    } catch (error) {
      await Promise.allSettled([
        SecureStore.deleteItemAsync(accessTokenKey),
        SecureStore.deleteItemAsync(refreshTokenKey),
      ]);
      throw error;
    }
    setAccessToken(accessToken);
    const { activeAccountId } = accountsStateRef.current;
    if (activeAccountId) {
      const next = withAccountTokens(accountsStateRef.current, activeAccountId, { accessToken, refreshToken });
      accountsStateRef.current = next;
      setAccountsState(next);
      saveAccounts(next).catch(() => {});
    }
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
          try {
            await storeTokens(tokenResponse.access_token, tokenResponse.refresh_token);
          } catch (error) {
            console.error("Failed to store tokens:", error);
            Sentry.captureException(error, { tags: { auth_path: "token_storage_failed" } });
            Alert.alert(
              "Couldn't save your sign-in",
              "Tap Sign in with Gumroad to try again. If it keeps happening, restart your phone and try once more.",
            );
            return;
          }
          const creatorStatus = await fetchCreatorStatus(tokenResponse.access_token);
          setIsCreator(creatorStatus);
          void refreshAccountsWithToken(tokenResponse.access_token);
        } catch (error) {
          if (isInvalidGrantError(error)) {
            console.warn("Authorization code expired or already used:", error);
          } else {
            console.error("Failed to exchange code for tokens:", error);
            Sentry.captureException(error);
          }
        } finally {
          setIsLoading(false);
        }
      } else if (response?.type === "error") {
        if (response.error?.code === "access_denied" || response.error?.code === "state_mismatch") {
          console.warn("OAuth error:", response.error.code, response.error.message);
        } else {
          console.error("Auth error:", response.error);
          Sentry.captureException(response.error);
        }
        setIsLoading(false);
      }
    }
    handleAuthResponse();
  }, [response, redirectUri, authRequest?.codeVerifier, storeTokens, refreshAccountsWithToken]);

  const login = useCallback(async () => {
    if (authRequest) {
      try {
        await promptAsync();
      } catch (error) {
        console.warn("Login browser error:", error);
        Alert.alert("No browser found", "Please install a web browser to log in.");
      }
    }
  }, [authRequest, promptAsync]);

  const logout = useCallback(async () => {
    try {
      setIsLoading(true);
      await SecureStore.deleteItemAsync(accessTokenKey);
      await SecureStore.deleteItemAsync(refreshTokenKey);
      await clearAccounts();
      await clearSavedTab();
      accountsStateRef.current = emptyAccountsState;
      setAccountsState(emptyAccountsState);
      setAccessToken(null);
      setIsCreator(false);
      queryClient.clear();
      router.replace("/login");
    } catch (error) {
      console.error("Failed to logout:", error);
      Sentry.captureException(error);
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  const refreshTokenFn = useCallback(async (): Promise<string> => {
    if (inflightRefresh.current) return inflightRefresh.current;

    inflightRefresh.current = (async () => {
      try {
        let storedRefreshToken: string | null;
        try {
          storedRefreshToken = await SecureStore.getItemAsync(refreshTokenKey);
        } catch (readError) {
          if (isKeychainUnavailableError(readError)) throw new KeychainUnavailableError();
          throw readError;
        }
        if (!storedRefreshToken) throw new SessionExpiredError("No refresh token available");

        let tokenResponse: { access_token: string; refresh_token?: string };
        try {
          tokenResponse = await request<{ access_token: string; refresh_token?: string }>(tokenEndpoint, {
            method: "POST",
            data: {
              grant_type: "refresh_token",
              refresh_token: storedRefreshToken,
              client_id: env.EXPO_PUBLIC_GUMROAD_CLIENT_ID,
            },
          });
        } catch (requestError) {
          if (isInvalidGrantError(requestError)) {
            throw new SessionExpiredError("Refresh token is invalid or expired");
          }
          throw requestError;
        }
        await storeTokens(tokenResponse.access_token, tokenResponse.refresh_token);
        return tokenResponse.access_token;
      } finally {
        inflightRefresh.current = null;
      }
    })();

    return inflightRefresh.current;
  }, [storeTokens]);

  const refreshCreatorStatus = useCallback(async () => {
    const token = accessToken;
    if (!token) return;
    let result = await retryFetchCreatorStatus(token);
    if ("error" in result && result.error instanceof UnauthorizedError) {
      try {
        result = await retryFetchCreatorStatus(await refreshTokenFn());
      } catch (refreshError) {
        reportCreatorStatusError(refreshError);
        return;
      }
    }
    if ("error" in result) {
      reportCreatorStatusError(result.error);
      return;
    }
    setIsCreator((current) => current === true || result.isCreator);
  }, [accessToken, refreshTokenFn]);

  const refreshAccounts = useCallback(async () => {
    if (accessToken) await refreshAccountsWithToken(accessToken);
  }, [accessToken, refreshAccountsWithToken]);

  const switchAccount = useCallback(
    async (accountId: string): Promise<boolean> => {
      if (switchingRef.current || !accessToken) return false;
      if (accountId === accountsStateRef.current.activeAccountId) return true;
      switchingRef.current = true;
      setIsSwitchingAccount(true);
      try {
        if (inflightRefresh.current) await inflightRefresh.current.catch(() => undefined);
        let switchResponse: SwitchAccountResponse;
        try {
          switchResponse = await requestAccountSwitch(
            assertDefined(await SecureStore.getItemAsync(accessTokenKey)),
            accountId,
          );
        } catch (error) {
          if (!(error instanceof UnauthorizedError)) throw error;
          switchResponse = await requestAccountSwitch(await refreshTokenFn(), accountId);
        }
        const previousAccessToken = assertDefined(await SecureStore.getItemAsync(accessTokenKey));
        const previousRefreshToken = await SecureStore.getItemAsync(refreshTokenKey);

        const base = accountsStateRef.current;
        const previousState = base.activeAccountId
          ? withAccountTokens(base, base.activeAccountId, {
              accessToken: previousAccessToken,
              refreshToken: previousRefreshToken,
            })
          : base;
        const switchedAccount: StoredAccount = {
          ...profileFromApi(switchResponse.account),
          accessToken: switchResponse.access_token,
          refreshToken: switchResponse.refresh_token,
        };
        const nextState: AccountsState = {
          accounts: findAccount(previousState, switchedAccount.accountId)
            ? previousState.accounts.map((account) =>
                account.accountId === switchedAccount.accountId ? switchedAccount : account,
              )
            : [...previousState.accounts, switchedAccount],
          activeAccountId: switchedAccount.accountId,
        };

        accountsStateRef.current = nextState;
        try {
          await storeTokens(switchResponse.access_token, switchResponse.refresh_token);
        } catch (error) {
          accountsStateRef.current = previousState;
          await storeTokens(previousAccessToken, previousRefreshToken ?? undefined).catch(() => undefined);
          throw error;
        }
        await updateAccountsState(nextState);
        await clearSavedTab();
        queryClient.clear();
        router.replace("/(tabs)/dashboard");
        setIsCreator(await fetchCreatorStatus(switchResponse.access_token));
        void refreshAccountsWithToken(switchResponse.access_token);
        return true;
      } catch (error) {
        console.warn("Failed to switch account:", error);
        if (!(error instanceof UnauthorizedError) && !(error instanceof SessionExpiredError)) {
          Sentry.captureException(error);
        }
        Alert.alert("Something went wrong.");
        return false;
      } finally {
        switchingRef.current = false;
        setIsSwitchingAccount(false);
      }
    },
    [accessToken, refreshAccountsWithToken, refreshTokenFn, router, storeTokens, updateAccountsState],
  );

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
        refreshCreatorStatus,
        accounts: accountsState.accounts,
        activeAccountId: accountsState.activeAccountId,
        isSwitchingAccount,
        switchAccount,
        refreshAccounts,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => assertDefined(useContext(AuthContext));
