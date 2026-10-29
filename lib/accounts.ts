import { requestAPI } from "@/lib/request";
import * as SecureStore from "expo-secure-store";

export interface AccountProfile {
  accountId: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
}

export interface StoredAccount extends AccountProfile {
  accessToken: string | null;
  refreshToken: string | null;
}

export interface AccountsState {
  accounts: StoredAccount[];
  activeAccountId: string | null;
  ownAccountId: string | null;
}

interface ApiAccount {
  id: string;
  name: string;
  username: string | null;
  avatar_url: string | null;
  is_active: boolean;
}

interface AccountsResponse {
  accounts: ApiAccount[];
}

export interface SwitchAccountResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number | null;
  account: ApiAccount;
}

const accountsKey = "gumroad_accounts";

const secureStoreOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

const toProfile = (account: ApiAccount): AccountProfile => ({
  accountId: account.id,
  name: account.name,
  username: account.username,
  avatarUrl: account.avatar_url,
});

const isStoredAccount = (value: unknown): value is StoredAccount =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as StoredAccount).accountId === "string" &&
  typeof (value as StoredAccount).name === "string";

const emptyAccountsState: AccountsState = { accounts: [], activeAccountId: null, ownAccountId: null };

const parseAccountsState = (raw: string | null): AccountsState => {
  if (!raw) return emptyAccountsState;
  try {
    const parsed: unknown = JSON.parse(raw);
    const snapshot = typeof parsed === "object" && parsed !== null ? (parsed as Partial<AccountsState>) : {};
    const accounts = Array.isArray(snapshot.accounts) ? snapshot.accounts.filter(isStoredAccount) : [];
    const storedAccountId = (accountId: unknown) =>
      typeof accountId === "string" && accounts.some((account) => account.accountId === accountId) ? accountId : null;
    return {
      accounts,
      activeAccountId: storedAccountId(snapshot.activeAccountId),
      ownAccountId: storedAccountId(snapshot.ownAccountId),
    };
  } catch {
    return emptyAccountsState;
  }
};

export const loadAccounts = async (): Promise<AccountsState> =>
  parseAccountsState(await SecureStore.getItemAsync(accountsKey));

export const saveAccounts = async ({ accounts, activeAccountId, ownAccountId }: AccountsState) => {
  await SecureStore.setItemAsync(
    accountsKey,
    JSON.stringify({ accounts, activeAccountId, ownAccountId }),
    secureStoreOptions,
  );
};

export const clearAccounts = () => SecureStore.deleteItemAsync(accountsKey);

export const findAccount = (state: AccountsState, accountId: string | null) =>
  state.accounts.find((account) => account.accountId === accountId);

export const withAccountTokens = (
  state: AccountsState,
  accountId: string,
  tokens: { accessToken: string; refreshToken?: string | null },
): AccountsState => ({
  ...state,
  accounts: state.accounts.map((account) =>
    account.accountId === accountId
      ? { ...account, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken ?? account.refreshToken }
      : account,
  ),
});

export const mergeServerAccounts = (
  state: AccountsState,
  serverAccounts: ApiAccount[],
  activeTokens: { accessToken: string; refreshToken: string | null },
): AccountsState => {
  const serverActive = serverAccounts.find((account) => account.is_active);
  const activeAccountId = serverActive?.id ?? state.activeAccountId;
  const ownAccountId =
    state.ownAccountId ??
    (state.activeAccountId === null && serverAccounts[0]?.is_active ? serverAccounts[0].id : null);
  const accounts = serverAccounts.map((serverAccount): StoredAccount => {
    const stored = findAccount(state, serverAccount.id);
    const isActive = serverAccount.id === activeAccountId;
    return {
      ...toProfile(serverAccount),
      accessToken: isActive ? activeTokens.accessToken : (stored?.accessToken ?? null),
      refreshToken: isActive ? activeTokens.refreshToken : (stored?.refreshToken ?? null),
    };
  });
  return { accounts, activeAccountId, ownAccountId };
};

export const fetchAccounts = async (accessToken: string) =>
  (await requestAPI<AccountsResponse>("mobile/accounts", { accessToken })).accounts;

export const requestAccountSwitch = (accessToken: string, accountId: string) =>
  requestAPI<SwitchAccountResponse>("mobile/accounts", {
    method: "POST",
    accessToken,
    data: { id: accountId },
  });

export const profileFromApi = toProfile;
