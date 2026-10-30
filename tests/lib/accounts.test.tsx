import * as Sentry from "@sentry/react-native";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import * as AuthSession from "expo-auth-session";
import * as SecureStore from "expo-secure-store";
import React from "react";
import { Alert } from "react-native";

import { AuthProvider, useAuth } from "@/lib/auth-context";
import { queryClient } from "@/lib/query-client";
import { request, requestAPI } from "@/lib/request";
import { clearSavedTab } from "@/lib/tab-preference";

const mockReplace = jest.fn();
const mockCanDismiss = jest.fn();
const mockDismissAll = jest.fn();

jest.mock("expo-auth-session");
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
  AFTER_FIRST_UNLOCK: "after_first_unlock_sentinel",
}));
jest.mock("expo-web-browser", () => ({ maybeCompleteAuthSession: jest.fn() }));
jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace, canDismiss: mockCanDismiss, dismissAll: mockDismissAll }),
}));
jest.mock("@/lib/tab-preference", () => ({ clearSavedTab: jest.fn().mockResolvedValue(undefined) }));
jest.mock("@/lib/query-client", () => ({ queryClient: { clear: jest.fn() } }));
jest.mock("@/lib/request", () => {
  class UnauthorizedError extends Error {}
  class SessionExpiredError extends Error {}
  class KeychainUnavailableError extends Error {}
  return {
    request: jest.fn(),
    requestAPI: jest.fn(),
    isInvalidGrantError: (error: unknown) => error instanceof Error && error.message.includes("invalid_grant"),
    UnauthorizedError,
    SessionExpiredError,
    KeychainUnavailableError,
  };
});

const mockRequest = request as jest.Mock;
const mockRequestAPI = requestAPI as jest.Mock;
const store = new Map<string, string>();

const apiAccount = (id: string, name: string, isActive: boolean) => ({
  id,
  name,
  username: name.toLowerCase(),
  avatar_url: null,
  is_active: isActive,
});

const seedStore = () => {
  store.set("gumroad_access_token", "member-access");
  store.set("gumroad_refresh_token", "member-refresh");
};

const renderAuth = () => {
  (AuthSession.useAuthRequest as jest.Mock).mockReturnValue([{ codeVerifier: "v" }, null, jest.fn()]);
  (AuthSession.makeRedirectUri as jest.Mock).mockReturnValue("gumroadmobile://redirect");
  return renderHook(() => useAuth(), {
    wrapper: ({ children }: { children: React.ReactNode }) => <AuthProvider>{children}</AuthProvider>,
  });
};

const storedSnapshot = () => JSON.parse(store.get("gumroad_accounts") ?? '{"accounts":[],"activeAccountId":null}');
const storedAccounts = () => storedSnapshot().accounts;

const deferred = <T,>() => {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

const invalidGrant = () => new Error('Request failed: 400 {"error":"invalid_grant"}');

const storedAccount = (accountId: string, name: string, accessToken: string, refreshToken: string) => ({
  accountId,
  name,
  username: name.toLowerCase(),
  avatarUrl: null,
  accessToken,
  refreshToken,
});

const switchResponse = {
  access_token: "brand-access",
  refresh_token: "brand-refresh",
  expires_in: null,
  account: apiAccount("brand", "Brand", true),
};

const accountsFor = (accessToken: string) =>
  accessToken === "brand-access"
    ? { accounts: [apiAccount("member", "Member", false), apiAccount("brand", "Brand", true)] }
    : { accounts: [apiAccount("member", "Member", true), apiAccount("brand", "Brand", false)] };

beforeEach(() => {
  jest.clearAllMocks();
  store.clear();
  (SecureStore.getItemAsync as jest.Mock).mockImplementation(async (key: string) => store.get(key) ?? null);
  (SecureStore.setItemAsync as jest.Mock).mockImplementation(async (key: string, value: string) => {
    store.set(key, value);
  });
  (SecureStore.deleteItemAsync as jest.Mock).mockImplementation(async (key: string) => {
    store.delete(key);
  });
  mockRequest.mockResolvedValue({ products: [{ id: "p" }] });
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
});

describe("multi-account store", () => {
  it("loads the account list from the server and keeps the signed-in account active", async () => {
    seedStore();
    mockRequestAPI.mockResolvedValue({
      accounts: [apiAccount("member", "Member", true), apiAccount("brand", "Brand", false)],
    });

    const { result } = renderAuth();

    await waitFor(() => expect(result.current.accounts).toHaveLength(2));
    expect(mockRequestAPI).toHaveBeenCalledWith("mobile/accounts", { accessToken: "member-access" });
    expect(result.current.activeAccountId).toBe("member");
    expect(storedAccounts()).toEqual([
      {
        accountId: "member",
        name: "Member",
        username: "member",
        avatarUrl: null,
        accessToken: "member-access",
        refreshToken: "member-refresh",
      },
      { accountId: "brand", name: "Brand", username: "brand", avatarUrl: null, accessToken: null, refreshToken: null },
    ]);
  });

  it("restores the last-used account on launch", async () => {
    store.set("gumroad_access_token", "brand-access");
    store.set("gumroad_refresh_token", "brand-refresh");
    store.set(
      "gumroad_accounts",
      JSON.stringify({
        accounts: [
          storedAccount("member", "Member", "member-access", "member-refresh"),
          storedAccount("brand", "Brand", "brand-access", "brand-refresh"),
        ],
        activeAccountId: "brand",
      }),
    );
    mockRequestAPI.mockReturnValue(new Promise(() => {}));

    const { result } = renderAuth();

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.accessToken).toBe("brand-access");
    expect(result.current.activeAccountId).toBe("brand");
    expect(result.current.accounts.map((account) => account.accountId)).toEqual(["member", "brand"]);
  });

  it("switches to another account, stores its tokens, resets queries, and opens the Dashboard", async () => {
    seedStore();
    mockRequestAPI.mockImplementation(async (path: string, options: { method?: string; accessToken: string }) => {
      if (options.method === "POST") {
        return {
          access_token: "brand-access",
          refresh_token: "brand-refresh",
          expires_in: null,
          account: apiAccount("brand", "Brand", true),
        };
      }
      return options.accessToken === "brand-access"
        ? { accounts: [apiAccount("member", "Member", false), apiAccount("brand", "Brand", true)] }
        : { accounts: [apiAccount("member", "Member", true), apiAccount("brand", "Brand", false)] };
    });
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.accounts).toHaveLength(2));

    let switched = false;
    await act(async () => {
      switched = await result.current.switchAccount("brand");
    });

    expect(switched).toBe(true);
    expect(mockRequestAPI).toHaveBeenCalledWith("mobile/accounts", {
      method: "POST",
      accessToken: "member-access",
      data: { id: "brand" },
    });
    expect(result.current.accessToken).toBe("brand-access");
    expect(result.current.activeAccountId).toBe("brand");
    expect(store.get("gumroad_access_token")).toBe("brand-access");
    expect(store.get("gumroad_refresh_token")).toBe("brand-refresh");
    expect(storedSnapshot().activeAccountId).toBe("brand");
    expect(queryClient.clear).toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith("/(tabs)/dashboard");
    await waitFor(() =>
      expect(storedAccounts()).toEqual([
        expect.objectContaining({ accountId: "member", accessToken: "member-access", refreshToken: "member-refresh" }),
        expect.objectContaining({ accountId: "brand", accessToken: "brand-access", refreshToken: "brand-refresh" }),
      ]),
    );
  });

  it("keeps the current account when the switch fails", async () => {
    seedStore();
    const forbidden = new Error("Request failed: 403");
    mockRequestAPI.mockImplementation(async (_path: string, options: { method?: string }) => {
      if (options.method === "POST") throw forbidden;
      return { accounts: [apiAccount("member", "Member", true), apiAccount("brand", "Brand", false)] };
    });
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.accounts).toHaveLength(2));

    let switched = true;
    await act(async () => {
      switched = await result.current.switchAccount("brand");
    });

    expect(switched).toBe(false);
    expect(result.current.accessToken).toBe("member-access");
    expect(result.current.activeAccountId).toBe("member");
    expect(store.get("gumroad_access_token")).toBe("member-access");
    expect(store.get("gumroad_refresh_token")).toBe("member-refresh");
    expect(queryClient.clear).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith("Something went wrong.");
    expect(Sentry.captureException).toHaveBeenCalledWith(forbidden);
    expect(result.current.isSwitchingAccount).toBe(false);
  });

  it("clears the account list on logout", async () => {
    seedStore();
    mockRequestAPI.mockResolvedValue({
      accounts: [apiAccount("member", "Member", true), apiAccount("brand", "Brand", false)],
    });
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.accounts).toHaveLength(2));

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.accounts).toEqual([]);
    expect(store.has("gumroad_accounts")).toBe(false);
    expect(store.has("gumroad_access_token")).toBe(false);
  });
});

describe("account session consistency", () => {
  const { UnauthorizedError } = jest.requireMock("@/lib/request");

  const mockAccountsApi = (switchResult: Promise<typeof switchResponse> | typeof switchResponse = switchResponse) =>
    mockRequestAPI.mockImplementation(async (_path: string, options: { method?: string; accessToken: string }) =>
      options.method === "POST" ? switchResult : accountsFor(options.accessToken),
    );

  it("keeps the switched account when a token refresh started during the switch finishes afterwards", async () => {
    seedStore();
    const pendingSwitch = deferred<typeof switchResponse>();
    const pendingRefresh = deferred<{ access_token: string; refresh_token: string }>();
    mockAccountsApi(pendingSwitch.promise);
    mockRequest.mockImplementation(async (url: string) =>
      url.includes("/oauth/token") ? pendingRefresh.promise : { products: [{ id: "p" }] },
    );
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.accounts).toHaveLength(2));

    let switchPromise: Promise<boolean> = Promise.resolve(false);
    act(() => {
      switchPromise = result.current.switchAccount("brand");
    });
    await waitFor(() =>
      expect(mockRequestAPI).toHaveBeenCalledWith("mobile/accounts", expect.objectContaining({ method: "POST" })),
    );
    const refreshPromise = result.current.refreshToken();
    await waitFor(() =>
      expect(mockRequest).toHaveBeenCalledWith(expect.stringContaining("/oauth/token"), expect.anything()),
    );

    await act(async () => {
      pendingSwitch.resolve(switchResponse);
      await switchPromise;
    });
    let refreshedToken = "";
    await act(async () => {
      pendingRefresh.resolve({ access_token: "member-access-2", refresh_token: "member-refresh-2" });
      refreshedToken = await refreshPromise;
    });

    expect(refreshedToken).toBe("brand-access");
    expect(result.current.accessToken).toBe("brand-access");
    expect(result.current.activeAccountId).toBe("brand");
    expect(store.get("gumroad_access_token")).toBe("brand-access");
    expect(store.get("gumroad_refresh_token")).toBe("brand-refresh");
    expect(storedAccounts()).toContainEqual(
      expect.objectContaining({ accountId: "brand", accessToken: "brand-access", refreshToken: "brand-refresh" }),
    );
    expect(storedAccounts()).toContainEqual(
      expect.objectContaining({
        accountId: "member",
        accessToken: "member-access-2",
        refreshToken: "member-refresh-2",
      }),
    );
    expect(storedSnapshot()).toEqual(expect.objectContaining({ activeAccountId: "brand", ownAccountId: "member" }));

    mockRequest.mockImplementation(async (url: string, options: { data?: { refresh_token?: string } }) => {
      if (!url.includes("/oauth/token")) return { products: [{ id: "p" }] };
      if (options.data?.refresh_token === "member-refresh-2") {
        return { access_token: "member-access-3", refresh_token: "member-refresh-3" };
      }
      throw invalidGrant();
    });
    let recoveredToken = "";
    await act(async () => {
      recoveredToken = await result.current.refreshToken();
    });

    expect(recoveredToken).toBe("member-access-3");
    expect(result.current.activeAccountId).toBe("member");
    expect(store.get("gumroad_access_token")).toBe("member-access-3");
    expect(store.get("gumroad_refresh_token")).toBe("member-refresh-3");
    expect(storedSnapshot()).toEqual({
      accounts: [expect.objectContaining({ accountId: "member", refreshToken: "member-refresh-3" })],
      activeAccountId: "member",
      ownAccountId: "member",
    });
  });

  it("waits for a switch to finish saving its tokens before reading the refresh token", async () => {
    seedStore();
    mockAccountsApi();
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.accounts).toHaveLength(2));
    mockRequest.mockClear();

    const brandRefreshWrite = deferred<void>();
    const releaseBrandRefreshWrite = deferred<void>();
    (SecureStore.setItemAsync as jest.Mock).mockImplementation(async (key: string, value: string) => {
      if (key === "gumroad_refresh_token" && value === "brand-refresh") {
        brandRefreshWrite.resolve();
        await releaseBrandRefreshWrite.promise;
      }
      store.set(key, value);
    });

    let switchPromise: Promise<boolean> = Promise.resolve(false);
    act(() => {
      switchPromise = result.current.switchAccount("brand");
    });
    await brandRefreshWrite.promise;
    expect(store.has("gumroad_refresh_token")).toBe(false);

    const refreshResult = result.current.refreshToken().then(
      (token) => ({ token }),
      (error: unknown) => ({ error }),
    );
    await act(async () => {
      releaseBrandRefreshWrite.resolve();
      await switchPromise;
    });

    expect(await refreshResult).toEqual({ token: "brand-access" });
    expect(result.current.accessToken).toBe("brand-access");
    expect(result.current.activeAccountId).toBe("brand");
    expect(store.get("gumroad_access_token")).toBe("brand-access");
    expect(store.get("gumroad_refresh_token")).toBe("brand-refresh");
    expect(mockRequest).not.toHaveBeenCalledWith(expect.stringContaining("/oauth/token"), expect.anything());
  });

  it("does not save tokens from a refresh that finishes while the user is logging out", async () => {
    const { SessionExpiredError } = jest.requireMock("@/lib/request");
    seedStore();
    const pendingSwitch = deferred<typeof switchResponse>();
    const pendingRefresh = deferred<{ access_token: string; refresh_token: string }>();
    mockAccountsApi(pendingSwitch.promise);
    mockRequest.mockImplementation(async (url: string) =>
      url.includes("/oauth/token") ? pendingRefresh.promise : { products: [{ id: "p" }] },
    );
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.accounts).toHaveLength(2));

    let switchPromise: Promise<boolean> = Promise.resolve(false);
    act(() => {
      switchPromise = result.current.switchAccount("brand");
    });
    await waitFor(() =>
      expect(mockRequestAPI).toHaveBeenCalledWith("mobile/accounts", expect.objectContaining({ method: "POST" })),
    );
    const refreshPromise = result.current.refreshToken();
    await waitFor(() =>
      expect(mockRequest).toHaveBeenCalledWith(expect.stringContaining("/oauth/token"), expect.anything()),
    );
    await act(async () => {
      pendingSwitch.resolve(switchResponse);
      await switchPromise;
    });
    await waitFor(() => expect(storedSnapshot().ownAccountId).toBe("member"));

    const logoutTabClear = deferred<void>();
    (clearSavedTab as jest.Mock).mockImplementationOnce(() => logoutTabClear.promise);
    let logoutPromise: Promise<void> = Promise.resolve();
    act(() => {
      logoutPromise = result.current.logout();
    });
    await waitFor(() => expect(store.has("gumroad_accounts")).toBe(false));

    await act(async () => {
      pendingRefresh.resolve({ access_token: "member-access-2", refresh_token: "member-refresh-2" });
      await expect(refreshPromise).rejects.toBeInstanceOf(SessionExpiredError);
      logoutTabClear.resolve();
      await logoutPromise;
    });

    expect(result.current.accessToken).toBeNull();
    expect(result.current.accounts).toEqual([]);
    expect(store.has("gumroad_accounts")).toBe(false);
    expect(store.has("gumroad_access_token")).toBe(false);
    expect(store.has("gumroad_refresh_token")).toBe(false);
  });

  it("does not sign the user back in when they log out while a switch is being saved", async () => {
    seedStore();
    const pendingSwitch = deferred<typeof switchResponse>();
    mockAccountsApi(pendingSwitch.promise);
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.accounts).toHaveLength(2));

    let switchPromise: Promise<boolean> = Promise.resolve(true);
    act(() => {
      switchPromise = result.current.switchAccount("brand");
    });
    await waitFor(() =>
      expect(mockRequestAPI).toHaveBeenCalledWith("mobile/accounts", expect.objectContaining({ method: "POST" })),
    );

    const refreshTokenRead = deferred<void>();
    const releaseRefreshTokenRead = deferred<void>();
    (SecureStore.getItemAsync as jest.Mock).mockImplementation(async (key: string) => {
      if (key === "gumroad_refresh_token") {
        refreshTokenRead.resolve();
        await releaseRefreshTokenRead.promise;
      }
      return store.get(key) ?? null;
    });
    pendingSwitch.resolve(switchResponse);
    await refreshTokenRead.promise;

    let switched = true;
    await act(async () => {
      const logoutPromise = result.current.logout();
      releaseRefreshTokenRead.resolve();
      [switched] = await Promise.all([switchPromise, logoutPromise]);
    });

    expect(switched).toBe(false);
    expect(result.current.accessToken).toBeNull();
    expect(result.current.accounts).toEqual([]);
    expect(store.has("gumroad_access_token")).toBe(false);
    expect(store.has("gumroad_refresh_token")).toBe(false);
    expect(store.has("gumroad_accounts")).toBe(false);
    expect(mockReplace).not.toHaveBeenCalledWith("/(tabs)/dashboard");
  });

  it("ignores an account list that was requested before switching accounts", async () => {
    seedStore();
    const staleAccounts = deferred<ReturnType<typeof accountsFor>>();
    let memberListRequests = 0;
    mockRequestAPI.mockImplementation(async (_path: string, options: { method?: string; accessToken: string }) => {
      if (options.method === "POST") return switchResponse;
      if (options.accessToken === "member-access" && ++memberListRequests > 1) return staleAccounts.promise;
      return accountsFor(options.accessToken);
    });
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.accounts).toHaveLength(2));

    let staleRefresh: Promise<void> = Promise.resolve();
    act(() => {
      staleRefresh = result.current.refreshAccounts();
    });
    await act(async () => {
      await result.current.switchAccount("brand");
    });
    await waitFor(() =>
      expect(storedAccounts()).toContainEqual(
        expect.objectContaining({ accountId: "brand", accessToken: "brand-access" }),
      ),
    );

    await act(async () => {
      staleAccounts.resolve(accountsFor("member-access"));
      await staleRefresh;
    });

    expect(result.current.activeAccountId).toBe("brand");
    expect(storedSnapshot().activeAccountId).toBe("brand");
    expect(storedAccounts()).toEqual([
      expect.objectContaining({ accountId: "member", accessToken: "member-access", refreshToken: "member-refresh" }),
      expect.objectContaining({ accountId: "brand", accessToken: "brand-access", refreshToken: "brand-refresh" }),
    ]);
  });

  it("loads the account list with a refreshed token when the stored access token has expired", async () => {
    seedStore();
    mockRequestAPI.mockImplementation(async (_path: string, options: { accessToken: string }) => {
      if (options.accessToken === "member-access") throw new UnauthorizedError("Unauthorized");
      return accountsFor(options.accessToken);
    });
    mockRequest.mockImplementation(async (url: string) =>
      url.includes("/oauth/token")
        ? { access_token: "member-access-2", refresh_token: "member-refresh-2" }
        : { products: [{ id: "p" }] },
    );

    const { result } = renderAuth();

    await waitFor(() => expect(result.current.accounts).toHaveLength(2));
    expect(mockRequestAPI).toHaveBeenLastCalledWith("mobile/accounts", { accessToken: "member-access-2" });
    expect(result.current.activeAccountId).toBe("member");
    expect(storedAccounts()).toContainEqual(
      expect.objectContaining({
        accountId: "member",
        accessToken: "member-access-2",
        refreshToken: "member-refresh-2",
      }),
    );
  });

  it("saves the account snapshot before the token items when switching", async () => {
    seedStore();
    mockAccountsApi();
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.accounts).toHaveLength(2));
    (SecureStore.setItemAsync as jest.Mock).mockClear();

    await act(async () => {
      await result.current.switchAccount("brand");
    });

    const writtenKeys = (SecureStore.setItemAsync as jest.Mock).mock.calls.map(([key]) => key);
    expect(writtenKeys.slice(0, 3)).toEqual(["gumroad_accounts", "gumroad_access_token", "gumroad_refresh_token"]);
  });

  it("restores a single account's tokens on launch after a switch was interrupted", async () => {
    store.set("gumroad_access_token", "brand-access");
    store.set("gumroad_refresh_token", "member-refresh");
    store.set(
      "gumroad_accounts",
      JSON.stringify({
        accounts: [
          storedAccount("member", "Member", "member-access", "member-refresh"),
          storedAccount("brand", "Brand", "brand-access", "brand-refresh"),
        ],
        activeAccountId: "brand",
      }),
    );
    mockRequestAPI.mockReturnValue(new Promise(() => {}));

    const { result } = renderAuth();

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.accessToken).toBe("brand-access");
    expect(result.current.activeAccountId).toBe("brand");
    expect(store.get("gumroad_access_token")).toBe("brand-access");
    expect(store.get("gumroad_refresh_token")).toBe("brand-refresh");
  });
});

describe("launching after a switch was interrupted before the token items were saved", () => {
  const seedInterruptedSwitch = (activeAccountId: string, tokenItems: { access: string; refresh: string }) => {
    store.set("gumroad_access_token", tokenItems.access);
    store.set("gumroad_refresh_token", tokenItems.refresh);
    store.set(
      "gumroad_accounts",
      JSON.stringify({
        accounts: [
          storedAccount("member", "Member", "member-access", "member-refresh"),
          storedAccount("brand", "Brand", "brand-access", "brand-refresh"),
        ],
        activeAccountId,
        ownAccountId: "member",
      }),
    );
    mockRequestAPI.mockRejectedValue(new Error("Request failed: 503"));
    mockRequest.mockImplementation(async (url: string, options: { data?: { refresh_token?: string } }) => {
      if (!url.includes("/oauth/token")) return { products: [{ id: "p" }] };
      const accountId = options.data?.refresh_token?.split("-")[0];
      return { access_token: `${accountId}-access-2`, refresh_token: `${accountId}-refresh-2` };
    });
  };

  it("keeps the member active and saves refreshed tokens to the member when a switch to the brand was interrupted", async () => {
    seedInterruptedSwitch("brand", { access: "member-access", refresh: "member-refresh" });

    const { result } = renderAuth();

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await waitFor(() => expect(mockRequestAPI).toHaveBeenCalled());
    expect(result.current.accessToken).toBe("member-access");
    expect(result.current.activeAccountId).toBe("member");

    await act(async () => {
      await result.current.refreshToken();
    });

    expect(result.current.activeAccountId).toBe("member");
    expect(store.get("gumroad_access_token")).toBe("member-access-2");
    expect(store.get("gumroad_refresh_token")).toBe("member-refresh-2");
    expect(storedSnapshot()).toEqual({
      accounts: [
        expect.objectContaining({
          accountId: "member",
          accessToken: "member-access-2",
          refreshToken: "member-refresh-2",
        }),
        expect.objectContaining({ accountId: "brand", accessToken: "brand-access", refreshToken: "brand-refresh" }),
      ],
      activeAccountId: "member",
      ownAccountId: "member",
    });
  });

  it("keeps the brand active and saves refreshed tokens to the brand when a switch to the member was interrupted", async () => {
    seedInterruptedSwitch("member", { access: "brand-access", refresh: "brand-refresh" });

    const { result } = renderAuth();

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await waitFor(() => expect(mockRequestAPI).toHaveBeenCalled());
    expect(result.current.accessToken).toBe("brand-access");
    expect(result.current.activeAccountId).toBe("brand");

    await act(async () => {
      await result.current.refreshToken();
    });

    expect(result.current.activeAccountId).toBe("brand");
    expect(store.get("gumroad_access_token")).toBe("brand-access-2");
    expect(store.get("gumroad_refresh_token")).toBe("brand-refresh-2");
    expect(storedSnapshot()).toEqual({
      accounts: [
        expect.objectContaining({ accountId: "member", accessToken: "member-access", refreshToken: "member-refresh" }),
        expect.objectContaining({ accountId: "brand", accessToken: "brand-access-2", refreshToken: "brand-refresh-2" }),
      ],
      activeAccountId: "brand",
      ownAccountId: "member",
    });
  });

  it("leaves no account active when the stored access token belongs to none of the saved accounts", async () => {
    seedInterruptedSwitch("brand", { access: "unknown-access", refresh: "unknown-refresh" });

    const { result } = renderAuth();

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await waitFor(() => expect(mockRequestAPI).toHaveBeenCalled());
    expect(result.current.accessToken).toBe("unknown-access");
    expect(result.current.activeAccountId).toBeNull();
    expect(result.current.accounts).toEqual([
      expect.objectContaining({ accountId: "member", accessToken: "member-access" }),
      expect.objectContaining({ accountId: "brand", accessToken: "brand-access" }),
    ]);
  });

  it("keeps the saved accounts and own account across a refresh and relaunch when the stored access token belongs to none of them", async () => {
    seedInterruptedSwitch("brand", { access: "unknown-access", refresh: "unknown-refresh" });

    const { result, unmount } = renderAuth();

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await waitFor(() => expect(mockRequestAPI).toHaveBeenCalled());
    expect(result.current.activeAccountId).toBeNull();

    await act(async () => {
      await result.current.refreshToken();
    });

    expect(result.current.accessToken).toBe("unknown-access-2");
    expect(store.get("gumroad_access_token")).toBe("unknown-access-2");
    expect(store.get("gumroad_refresh_token")).toBe("unknown-refresh-2");
    const savedAccounts = [
      expect.objectContaining({ accountId: "member", accessToken: "member-access", refreshToken: "member-refresh" }),
      expect.objectContaining({ accountId: "brand", accessToken: "brand-access", refreshToken: "brand-refresh" }),
    ];
    expect(storedSnapshot()).toEqual({ accounts: savedAccounts, activeAccountId: null, ownAccountId: "member" });

    unmount();
    mockRequestAPI.mockClear();
    const { result: relaunched } = renderAuth();

    await waitFor(() => expect(relaunched.current.isLoading).toBe(false));
    await waitFor(() => expect(mockRequestAPI).toHaveBeenCalled());
    expect(relaunched.current.accessToken).toBe("unknown-access-2");
    expect(relaunched.current.activeAccountId).toBeNull();
    expect(relaunched.current.accounts).toEqual(savedAccounts);
    expect(storedSnapshot()).toEqual({ accounts: savedAccounts, activeAccountId: null, ownAccountId: "member" });
  });
});

describe("account snapshot storage failures", () => {
  const snapshotWithMember = (accessToken: string, refreshToken: string) =>
    JSON.stringify({
      accounts: [storedAccount("member", "Member", accessToken, refreshToken)],
      activeAccountId: "member",
      ownAccountId: "member",
    });

  it("stays signed out on launch when only the account snapshot holds tokens", async () => {
    store.set("gumroad_accounts", snapshotWithMember("member-access", "member-refresh"));

    const { result } = renderAuth();

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.accessToken).toBeNull();
    expect(store.has("gumroad_access_token")).toBe(false);
    expect(store.has("gumroad_accounts")).toBe(false);
  });

  it("reports a failed account snapshot delete on logout and stays signed out on the next launch", async () => {
    seedStore();
    mockRequestAPI.mockResolvedValue({
      accounts: [apiAccount("member", "Member", true), apiAccount("brand", "Brand", false)],
    });
    const { result, unmount } = renderAuth();
    await waitFor(() => expect(storedAccounts()).toHaveLength(2));
    const deleteError = new Error("Keychain delete failed");
    (SecureStore.deleteItemAsync as jest.Mock).mockImplementation(async (key: string) => {
      if (key === "gumroad_accounts") throw deleteError;
      store.delete(key);
    });

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.accessToken).toBeNull();
    expect(store.has("gumroad_accounts")).toBe(true);
    expect(Sentry.captureException).toHaveBeenCalledWith(deleteError);
    unmount();

    const relaunched = renderAuth();

    await waitFor(() => expect(relaunched.result.current.isLoading).toBe(false));
    expect(relaunched.result.current.isAuthenticated).toBe(false);
    expect(store.has("gumroad_access_token")).toBe(false);
  });

  it("keeps newer token items on launch when the account snapshot could not be updated", async () => {
    seedStore();
    store.set("gumroad_accounts", snapshotWithMember("member-access", "member-refresh"));
    mockRequestAPI.mockReturnValue(new Promise(() => {}));
    mockRequest.mockImplementation(async (url: string) =>
      url.includes("/oauth/token")
        ? { access_token: "member-access-2", refresh_token: "member-refresh-2" }
        : { products: [{ id: "p" }] },
    );
    const { result, unmount } = renderAuth();
    await waitFor(() => expect(result.current.accessToken).toBe("member-access"));
    const writeError = new Error("Keychain write failed");
    (SecureStore.setItemAsync as jest.Mock).mockImplementation(async (key: string, value: string) => {
      if (key === "gumroad_accounts") throw writeError;
      store.set(key, value);
    });
    (SecureStore.deleteItemAsync as jest.Mock).mockImplementation(async (key: string) => {
      if (key === "gumroad_accounts") throw writeError;
      store.delete(key);
    });

    await act(async () => {
      await result.current.refreshToken();
    });

    expect(store.get("gumroad_access_token")).toBe("member-access-2");
    expect(storedAccounts()).toEqual([expect.objectContaining({ accessToken: "member-access" })]);
    expect(Sentry.captureException).toHaveBeenCalledWith(writeError);
    unmount();

    const relaunched = renderAuth();

    await waitFor(() => expect(relaunched.result.current.isLoading).toBe(false));
    expect(relaunched.result.current.accessToken).toBe("member-access-2");
    expect(store.get("gumroad_access_token")).toBe("member-access-2");
    expect(store.get("gumroad_refresh_token")).toBe("member-refresh-2");
  });
});

describe("losing access to a brand account", () => {
  const switchToBrand = async () => {
    seedStore();
    mockRequestAPI.mockImplementation(async (_path: string, options: { method?: string; accessToken: string }) =>
      options.method === "POST" ? switchResponse : accountsFor(options.accessToken),
    );
    const rendered = renderAuth();
    await waitFor(() => expect(rendered.result.current.accounts).toHaveLength(2));
    await act(async () => {
      await rendered.result.current.switchAccount("brand");
    });
    await waitFor(() => expect(storedSnapshot().ownAccountId).toBe("member"));
    jest.clearAllMocks();
    return rendered;
  };

  const mockRefreshGrants = (memberGrant: () => Promise<unknown>) =>
    mockRequest.mockImplementation(async (url: string, options: { data?: { refresh_token?: string } }) => {
      if (!url.includes("/oauth/token")) return { products: [{ id: "p" }] };
      if (options.data?.refresh_token === "member-refresh") return memberGrant();
      throw invalidGrant();
    });

  it("switches back to the member's own account when the brand's refresh token is revoked", async () => {
    const { result } = await switchToBrand();
    mockRefreshGrants(async () => ({ access_token: "member-access-2", refresh_token: "member-refresh-2" }));

    let refreshedToken = "";
    await act(async () => {
      refreshedToken = await result.current.refreshToken();
    });

    expect(refreshedToken).toBe("member-access-2");
    expect(result.current.accessToken).toBe("member-access-2");
    expect(result.current.activeAccountId).toBe("member");
    expect(result.current.accounts.map((account) => account.accountId)).toEqual(["member"]);
    expect(store.get("gumroad_access_token")).toBe("member-access-2");
    expect(store.get("gumroad_refresh_token")).toBe("member-refresh-2");
    expect(storedSnapshot()).toEqual({
      accounts: [expect.objectContaining({ accountId: "member", accessToken: "member-access-2" })],
      activeAccountId: "member",
      ownAccountId: "member",
    });
    expect(queryClient.clear).toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith("/(tabs)/dashboard");
    expect(Alert.alert).toHaveBeenCalledWith("You no longer have access to Brand.");
  });

  it("closes the brand's screens stacked over the tabs before opening the member's Dashboard", async () => {
    const { result } = await switchToBrand();
    mockRefreshGrants(async () => ({ access_token: "member-access-2", refresh_token: "member-refresh-2" }));
    mockCanDismiss.mockReturnValue(true);

    await act(async () => {
      await result.current.refreshToken();
    });

    expect(mockDismissAll).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith("/(tabs)/dashboard");
    expect(mockDismissAll.mock.invocationCallOrder[0]).toBeLessThan(mockReplace.mock.invocationCallOrder[0]);
  });

  it("reports an expired session when the member's own refresh token is also revoked", async () => {
    const { SessionExpiredError } = jest.requireMock("@/lib/request");
    const { result } = await switchToBrand();
    mockRefreshGrants(async () => {
      throw invalidGrant();
    });

    await act(async () => {
      await expect(result.current.refreshToken()).rejects.toBeInstanceOf(SessionExpiredError);
    });

    expect(result.current.activeAccountId).toBe("brand");
    expect(store.get("gumroad_access_token")).toBe("brand-access");
    expect(mockDismissAll).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it("keeps the member's rotated tokens when a switch finishes while switching back to the member", async () => {
    const { result } = await switchToBrand();
    const pendingSwitch = deferred<typeof switchResponse>();
    const pendingMemberGrant = deferred<{ access_token: string; refresh_token: string }>();
    mockRequestAPI.mockImplementation(async (_path: string, options: { method?: string; accessToken: string }) => {
      if (options.method === "POST") return pendingSwitch.promise;
      return options.accessToken === "other-brand-access"
        ? {
            accounts: [
              apiAccount("member", "Member", false),
              apiAccount("brand", "Brand", false),
              apiAccount("other-brand", "Other brand", true),
            ],
          }
        : accountsFor(options.accessToken);
    });
    mockRefreshGrants(() => pendingMemberGrant.promise);

    let switchPromise: Promise<boolean> = Promise.resolve(false);
    act(() => {
      switchPromise = result.current.switchAccount("other-brand");
    });
    await waitFor(() =>
      expect(mockRequestAPI).toHaveBeenCalledWith("mobile/accounts", expect.objectContaining({ method: "POST" })),
    );
    const refreshPromise = result.current.refreshToken();
    await waitFor(() =>
      expect(mockRequest).toHaveBeenCalledWith(
        expect.stringContaining("/oauth/token"),
        expect.objectContaining({ data: expect.objectContaining({ refresh_token: "member-refresh" }) }),
      ),
    );
    await act(async () => {
      pendingSwitch.resolve({
        access_token: "other-brand-access",
        refresh_token: "other-brand-refresh",
        expires_in: null,
        account: apiAccount("other-brand", "Other brand", true),
      });
      await switchPromise;
    });
    await waitFor(() => expect(storedAccounts()).toHaveLength(3));

    let refreshedToken = "";
    await act(async () => {
      pendingMemberGrant.resolve({ access_token: "member-access-2", refresh_token: "member-refresh-2" });
      refreshedToken = await refreshPromise;
    });

    expect(refreshedToken).toBe("other-brand-access");
    expect(result.current.accessToken).toBe("other-brand-access");
    expect(result.current.activeAccountId).toBe("other-brand");
    expect(store.get("gumroad_access_token")).toBe("other-brand-access");
    expect(store.get("gumroad_refresh_token")).toBe("other-brand-refresh");
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(storedSnapshot()).toEqual(
      expect.objectContaining({ activeAccountId: "other-brand", ownAccountId: "member" }),
    );
    expect(storedAccounts()).toContainEqual(
      expect.objectContaining({
        accountId: "member",
        accessToken: "member-access-2",
        refreshToken: "member-refresh-2",
      }),
    );

    mockRequest.mockImplementation(async (url: string, options: { data?: { refresh_token?: string } }) => {
      if (!url.includes("/oauth/token")) return { products: [{ id: "p" }] };
      if (options.data?.refresh_token === "member-refresh-2") {
        return { access_token: "member-access-3", refresh_token: "member-refresh-3" };
      }
      throw invalidGrant();
    });
    let recoveredToken = "";
    await act(async () => {
      recoveredToken = await result.current.refreshToken();
    });

    expect(recoveredToken).toBe("member-access-3");
    expect(result.current.activeAccountId).toBe("member");
    expect(store.get("gumroad_access_token")).toBe("member-access-3");
    expect(store.get("gumroad_refresh_token")).toBe("member-refresh-3");
  });

  it("does not save the member's tokens when switching back to the member finishes while the user is logging out", async () => {
    const { SessionExpiredError } = jest.requireMock("@/lib/request");
    const { result } = await switchToBrand();
    const pendingMemberGrant = deferred<{ access_token: string; refresh_token: string }>();
    mockRefreshGrants(() => pendingMemberGrant.promise);

    const refreshPromise = result.current.refreshToken();
    await waitFor(() =>
      expect(mockRequest).toHaveBeenCalledWith(
        expect.stringContaining("/oauth/token"),
        expect.objectContaining({ data: expect.objectContaining({ refresh_token: "member-refresh" }) }),
      ),
    );

    const logoutTabClear = deferred<void>();
    (clearSavedTab as jest.Mock).mockImplementationOnce(() => logoutTabClear.promise);
    let logoutPromise: Promise<void> = Promise.resolve();
    act(() => {
      logoutPromise = result.current.logout();
    });
    await waitFor(() => expect(store.has("gumroad_accounts")).toBe(false));

    await act(async () => {
      pendingMemberGrant.resolve({ access_token: "member-access-2", refresh_token: "member-refresh-2" });
      await expect(refreshPromise).rejects.toBeInstanceOf(SessionExpiredError);
      logoutTabClear.resolve();
      await logoutPromise;
    });

    expect(result.current.accessToken).toBeNull();
    expect(result.current.accounts).toEqual([]);
    expect(store.has("gumroad_accounts")).toBe(false);
    expect(store.has("gumroad_access_token")).toBe(false);
    expect(store.has("gumroad_refresh_token")).toBe(false);
    expect(Alert.alert).not.toHaveBeenCalled();
  });
});
