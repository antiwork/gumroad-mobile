import * as SecureStore from "expo-secure-store";

const LAST_TAB_KEY = "gumroad_last_tab";

export type TabName = "agent" | "analytics" | "library";

const VALID_TABS: TabName[] = ["agent", "analytics", "library"];

export const getSavedTab = async (): Promise<TabName | null> => {
  try {
    const value = await SecureStore.getItemAsync(LAST_TAB_KEY);
    return value && VALID_TABS.includes(value as TabName) ? (value as TabName) : null;
  } catch {
    return null;
  }
};

export const saveLastTab = (tab: string) => {
  if (!VALID_TABS.includes(tab as TabName)) return;
  SecureStore.setItemAsync(LAST_TAB_KEY, tab).catch(() => {});
};

export const clearSavedTab = async () => {
  try {
    await SecureStore.deleteItemAsync(LAST_TAB_KEY);
  } catch {}
};
