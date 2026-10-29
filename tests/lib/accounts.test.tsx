import * as Sentry from "@sentry/react-native";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import * as AuthSession from "expo-auth-session";
import * as SecureStore from "expo-secure-store";
import React from "react";
import { Alert } from "react-native";

import { AuthProvider, useAuth } from "@/lib/auth-context";
import { queryClient } from "@/lib/query-client";
import { request, requestAPI } from "@/lib/request";

const mockReplace = jest.fn();

jest.mock("expo-auth-session");
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
  AFTER_FIRST_UNLOCK: "after_first_unlock_sentinel",
}));
jest.mock("expo-web-browser", () => ({ maybeCompleteAuthSession: jest.fn() }));
jest.mock("expo-router", () => ({ useRouter: () => ({ replace: mockReplace }) }));
jest.mock("@/lib/tab-preference", () => ({ clearSavedTab: jest.fn().mockResolvedValue(undefined) }));
jest.mock("@/lib/query-client", () => ({ queryClient: { clear: jest.fn() } }));
jest.mock("@/lib/request", () => {
  class UnauthorizedError extends Error {}
  class SessionExpiredError extends Error {}
  class KeychainUnavailableError extends Error {}
  return {
    request: jest.fn(),
    requestAPI: jest.fn(),
    isInvalidGrantError: () => false,
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
