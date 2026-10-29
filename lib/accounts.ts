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
const activeAccountIdKey = "gumroad_active_account_id";

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

const parseAccounts = (raw: string | null): StoredAccount[] => {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isStoredAccount) : [];
  } catch {
    return [];
  }
};

export const loadAccounts = async (): Promise<AccountsState> => {
  const [rawAccounts, activeAccountId] = await Promise.all([
    SecureStore.getItemAsync(accountsKey),
    SecureStore.getItemAsync(activeAccountIdKey),
  ]);
  const accounts = parseAccounts(rawAccounts);
  const active = accounts.some((account) => account.accountId === activeAccountId) ? activeAccountId : null;
  return { accounts, activeAccountId: active };
};

export const saveAccounts = async ({ accounts, activeAccountId }: AccountsState) => {
  await SecureStore.setItemAsync(accountsKey, JSON.stringify(accounts), secureStoreOptions);
  if (activeAccountId) {
    await SecureStore.setItemAsync(activeAccountIdKey, activeAccountId, secureStoreOptions);
  } else {
    await SecureStore.deleteItemAsync(activeAccountIdKey);
  }
};

export const clearAccounts = async () => {
  await Promise.allSettled([SecureStore.deleteItemAsync(accountsKey), SecureStore.deleteItemAsync(activeAccountIdKey)]);
};

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
  const accounts = serverAccounts.map((serverAccount): StoredAccount => {
    const stored = findAccount(state, serverAccount.id);
    const isActive = serverAccount.id === activeAccountId;
    return {
      ...toProfile(serverAccount),
      accessToken: isActive ? activeTokens.accessToken : (stored?.accessToken ?? null),
      refreshToken: isActive ? activeTokens.refreshToken : (stored?.refreshToken ?? null),
    };
  });
  return { accounts, activeAccountId };
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
