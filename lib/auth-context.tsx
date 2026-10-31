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
import { useRefToLatest } from "@/components/use-ref-to-latest";
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
  /** Live read of the active account, for callers that must not act after a refresh moved it. */
  getActiveAccountId: () => string | null;
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

const emptyAccountsState: AccountsState = { accounts: [], activeAccountId: null, ownAccountId: null };

const isKeychainUnavailableError = (error: unknown): boolean =>
  error instanceof Error &&
  (error.message.includes("User interaction is not allowed") || error.message.includes("No keychain is available"));

const reportAccountsStorageError = (error: unknown) => {
  if (!isKeychainUnavailableError(error)) Sentry.captureException(error);
};

type SessionTokens = { accessToken: string; refreshToken?: string | null };

type TokenResponse = { access_token: string; refresh_token?: string };

const requestRefreshGrant = (refreshToken: string) =>
  request<TokenResponse>(tokenEndpoint, {
    method: "POST",
    data: {
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: env.EXPO_PUBLIC_GUMROAD_CLIENT_ID,
    },
  });

const writeTokens = async ({ accessToken, refreshToken }: SessionTokens) => {
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
};

const persistSession = async (state: AccountsState, tokens: SessionTokens) => {
  await (state.accounts.length > 0 ? saveAccounts(state).catch(clearAccounts) : clearAccounts()).catch(
    reportAccountsStorageError,
  );
  await writeTokens(tokens);
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isCreator, setIsCreator] = useState<boolean | null>(false);
  const inflightRefresh = useRef<{ session: number; promise: Promise<string> } | null>(null);
  const [accountsState, setAccountsState] = useState<AccountsState>(emptyAccountsState);
  const accountsStateRef = useRef<AccountsState>(emptyAccountsState);
  const [isSwitchingAccount, setIsSwitchingAccount] = useState(false);
  const switchingRef = useRef(false);
  const sessionRef = useRef(0);
  const signInRef = useRef(0);
  const storageQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const router = useRouter();
  const routerRef = useRefToLatest(router);

  const withStorageLock = useCallback(<T,>(task: () => Promise<T>): Promise<T> => {
    const run = storageQueueRef.current.then(task);
    storageQueueRef.current = run.catch(() => undefined);
    return run;
  }, []);

  const applyAccountsState = useCallback((next: AccountsState) => {
    accountsStateRef.current = next;
    setAccountsState(next);
  }, []);

  const commitTokens = useCallback(
    (session: number, tokens: SessionTokens) =>
      withStorageLock(async () => {
        if (sessionRef.current !== session) return false;
        const current = accountsStateRef.current;
        const next = current.activeAccountId ? withAccountTokens(current, current.activeAccountId, tokens) : current;
        await persistSession(next, tokens);
        if (sessionRef.current !== session) return false;
        applyAccountsState(next);
        setAccessToken(tokens.accessToken);
        return true;
      }),
    [applyAccountsState, withStorageLock],
  );

  // The server revokes a refresh token as soon as it's used. If the user switched accounts while a refresh
  // was in flight, the new tokens belong to an account that's no longer active, so they're saved to that
  // account in the list. Otherwise it would be left with a revoked token and couldn't be switched back to.
  const keepRotatedTokens = useCallback(
    (signIn: number, grantRefreshToken: string, tokens: SessionTokens) =>
      withStorageLock(async () => {
        if (signInRef.current !== signIn) return;
        const current = accountsStateRef.current;
        const account = current.accounts.find((stored) => stored.refreshToken === grantRefreshToken);
        if (!account || account.accountId === current.activeAccountId) return;
        const next = withAccountTokens(current, account.accountId, tokens);
        await saveAccounts(next).catch(reportAccountsStorageError);
        if (signInRef.current === signIn) applyAccountsState(next);
      }),
    [applyAccountsState, withStorageLock],
  );

  const readCurrentAccessToken = useCallback(async () => {
    const currentAccessToken = await withStorageLock(() => SecureStore.getItemAsync(accessTokenKey));
    if (!currentAccessToken) throw new SessionExpiredError("Signed out while the token was refreshing");
    return currentAccessToken;
  }, [withStorageLock]);

  const restoreOwnAccount = useCallback(
    async (session: number, signIn: number): Promise<string | null> => {
      const state = accountsStateRef.current;
      const ownAccount = findAccount(state, state.ownAccountId);
      const lostAccount = findAccount(state, state.activeAccountId);
      if (!ownAccount?.refreshToken || !lostAccount || lostAccount === ownAccount) return null;

      let tokenResponse: TokenResponse;
      try {
        tokenResponse = await requestRefreshGrant(ownAccount.refreshToken);
      } catch (error) {
        if (isInvalidGrantError(error)) return null;
        throw error;
      }
      const tokens = { accessToken: tokenResponse.access_token, refreshToken: tokenResponse.refresh_token };

      const restoredSession = await withStorageLock(async () => {
        if (sessionRef.current !== session) return null;
        const current = accountsStateRef.current;
        const nextState = withAccountTokens(
          {
            ...current,
            accounts: current.accounts.filter((account) => account.accountId !== lostAccount.accountId),
            activeAccountId: ownAccount.accountId,
          },
          ownAccount.accountId,
          tokens,
        );
        await persistSession(nextState, tokens);
        if (sessionRef.current !== session) return null;
        sessionRef.current += 1;
        applyAccountsState(nextState);
        setAccessToken(tokens.accessToken);
        return sessionRef.current;
      });
      if (restoredSession === null) {
        await keepRotatedTokens(signIn, ownAccount.refreshToken, tokens);
        return readCurrentAccessToken();
      }

      await clearSavedTab();
      queryClient.clear();
      if (sessionRef.current === restoredSession) {
        if (routerRef.current.canDismiss()) routerRef.current.dismissAll();
        routerRef.current.replace("/(tabs)/dashboard");
        Alert.alert(`You no longer have access to ${lostAccount.name}.`);
      }
      void fetchCreatorStatus(tokens.accessToken).then((creatorStatus) => {
        if (sessionRef.current === restoredSession) setIsCreator(creatorStatus);
      });
      return tokens.accessToken;
    },
    [applyAccountsState, keepRotatedTokens, readCurrentAccessToken, routerRef, withStorageLock],
  );

  const refreshTokenFn = useCallback(async (): Promise<string> => {
    const session = sessionRef.current;
    const signIn = signInRef.current;
    if (inflightRefresh.current?.session === session) return inflightRefresh.current.promise;

    const promise = (async () => {
      try {
        let storedRefreshToken: string | null;
        try {
          const stored = await withStorageLock(async () =>
            sessionRef.current === session ? { refreshToken: await SecureStore.getItemAsync(refreshTokenKey) } : null,
          );
          if (!stored) return readCurrentAccessToken();
          storedRefreshToken = stored.refreshToken;
        } catch (readError) {
          if (isKeychainUnavailableError(readError)) throw new KeychainUnavailableError();
          throw readError;
        }
        if (!storedRefreshToken) throw new SessionExpiredError("No refresh token available");

        let tokenResponse: TokenResponse;
        try {
          tokenResponse = await requestRefreshGrant(storedRefreshToken);
        } catch (requestError) {
          if (isInvalidGrantError(requestError)) {
            const ownAccessToken = await restoreOwnAccount(session, signIn);
            if (ownAccessToken) return ownAccessToken;
            throw new SessionExpiredError("Refresh token is invalid or expired");
          }
          throw requestError;
        }
        const tokens = { accessToken: tokenResponse.access_token, refreshToken: tokenResponse.refresh_token };
        if (await commitTokens(session, tokens)) return tokenResponse.access_token;
        await keepRotatedTokens(signIn, storedRefreshToken, tokens);
        return readCurrentAccessToken();
      } finally {
        if (inflightRefresh.current?.session === session) inflightRefresh.current = null;
      }
    })();
    inflightRefresh.current = { session, promise };

    return promise;
  }, [commitTokens, keepRotatedTokens, readCurrentAccessToken, restoreOwnAccount, withStorageLock]);

  const refreshAccountsWithToken = useCallback(
    async (token: string) => {
      const session = sessionRef.current;
      try {
        let serverAccounts: Awaited<ReturnType<typeof fetchAccounts>>;
        try {
          serverAccounts = await fetchAccounts(token);
        } catch (error) {
          if (!(error instanceof UnauthorizedError) || sessionRef.current !== session) throw error;
          serverAccounts = await fetchAccounts(await refreshTokenFn());
        }
        await withStorageLock(async () => {
          const [currentAccessToken, currentRefreshToken] = await Promise.all([
            SecureStore.getItemAsync(accessTokenKey),
            SecureStore.getItemAsync(refreshTokenKey),
          ]);
          if (sessionRef.current !== session || !currentAccessToken) return;
          const next = mergeServerAccounts(accountsStateRef.current, serverAccounts, {
            accessToken: currentAccessToken,
            refreshToken: currentRefreshToken,
          });
          applyAccountsState(next);
          await saveAccounts(next).catch(reportAccountsStorageError);
        });
      } catch (error) {
        console.warn("Failed to load accounts:", error);
      }
    },
    [applyAccountsState, refreshTokenFn, withStorageLock],
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
        const token = await SecureStore.getItemAsync(accessTokenKey);
        if (!token) {
          await clearAccounts().catch(reportAccountsStorageError);
          return;
        }
        const snapshot = await loadAccounts().catch(() => emptyAccountsState);
        // The snapshot is saved before the token items, so if the app was killed in between, the snapshot's
        // active account can differ from the account the stored access token belongs to.
        const tokenAccount = snapshot.accounts.find((account) => account.accessToken === token);
        const storedAccounts = { ...snapshot, activeAccountId: tokenAccount?.accountId ?? null };
        if (tokenAccount?.refreshToken) {
          const storedRefreshToken = await SecureStore.getItemAsync(refreshTokenKey);
          if (tokenAccount.refreshToken !== storedRefreshToken) {
            await writeTokens({ accessToken: token, refreshToken: tokenAccount.refreshToken });
          }
        }
        setAccessToken(token);
        applyAccountsState(storedAccounts);
        const creatorStatus = await fetchCreatorStatus(token);
        setIsCreator(creatorStatus);
        void refreshAccountsWithToken(token);
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
  }, [applyAccountsState, refreshAccountsWithToken]);

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
          sessionRef.current += 1;
          signInRef.current += 1;
          const session = sessionRef.current;
          try {
            const tokens = { accessToken: tokenResponse.access_token, refreshToken: tokenResponse.refresh_token };
            if (!(await commitTokens(session, tokens))) return;
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
  }, [response, redirectUri, authRequest?.codeVerifier, commitTokens, refreshAccountsWithToken]);

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
    sessionRef.current += 1;
    signInRef.current += 1;
    try {
      setIsLoading(true);
      await withStorageLock(async () => {
        await clearAccounts().catch(reportAccountsStorageError);
        await SecureStore.deleteItemAsync(accessTokenKey);
        await SecureStore.deleteItemAsync(refreshTokenKey);
      });
      await clearSavedTab();
      applyAccountsState(emptyAccountsState);
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
  }, [applyAccountsState, router, withStorageLock]);

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

  const getActiveAccountId = useCallback(() => accountsStateRef.current.activeAccountId, []);

  const switchAccount = useCallback(
    async (accountId: string): Promise<boolean> => {
      if (switchingRef.current || !accessToken) return false;
      if (accountId === accountsStateRef.current.activeAccountId) return true;
      switchingRef.current = true;
      setIsSwitchingAccount(true);
      const session = sessionRef.current;
      try {
        if (inflightRefresh.current) await inflightRefresh.current.promise.catch(() => undefined);
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

        const switchedSession = await withStorageLock(async () => {
          if (sessionRef.current !== session) return null;
          const previousTokens: SessionTokens = {
            accessToken: assertDefined(await SecureStore.getItemAsync(accessTokenKey)),
            refreshToken: await SecureStore.getItemAsync(refreshTokenKey),
          };
          const base = accountsStateRef.current;
          const previousState = base.activeAccountId
            ? withAccountTokens(base, base.activeAccountId, previousTokens)
            : base;
          const switchedTokens = {
            accessToken: switchResponse.access_token,
            refreshToken: switchResponse.refresh_token,
          };
          const switchedAccount: StoredAccount = { ...profileFromApi(switchResponse.account), ...switchedTokens };
          const nextState: AccountsState = {
            accounts: findAccount(previousState, switchedAccount.accountId)
              ? previousState.accounts.map((account) =>
                  account.accountId === switchedAccount.accountId ? switchedAccount : account,
                )
              : [...previousState.accounts, switchedAccount],
            activeAccountId: switchedAccount.accountId,
            ownAccountId: previousState.ownAccountId,
          };

          try {
            await persistSession(nextState, switchedTokens);
          } catch (error) {
            await persistSession(previousState, previousTokens).catch(() => undefined);
            throw error;
          }
          if (sessionRef.current !== session) return null;
          sessionRef.current += 1;
          applyAccountsState(nextState);
          setAccessToken(switchResponse.access_token);
          return sessionRef.current;
        });
        if (switchedSession === null) return false;

        await clearSavedTab();
        queryClient.clear();
        if (sessionRef.current !== switchedSession) return false;
        router.replace("/(tabs)/dashboard");
        void refreshAccountsWithToken(switchResponse.access_token);
        const creatorStatus = await fetchCreatorStatus(switchResponse.access_token);
        if (sessionRef.current === switchedSession) setIsCreator(creatorStatus);
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
    [accessToken, applyAccountsState, refreshAccountsWithToken, refreshTokenFn, router, withStorageLock],
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
        getActiveAccountId,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => assertDefined(useContext(AuthContext));
