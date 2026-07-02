import * as SecureStore from "expo-secure-store";

// Persists the last tab the user visited so app launches land where they
// actually work. First launch (no saved tab) falls back to a sensible
// default chosen in app/index.tsx: Analytics for creators with sales,
// Library otherwise.

const LAST_TAB_KEY = "gumroad_last_tab";

export type TabName = "agent" | "analytics" | "library";

const VALID_TABS: TabName[] = ["agent", "analytics", "library"];

export const getSavedTab = async (): Promise<TabName | null> => {
  try {
    const value = await SecureStore.getItemAsync(LAST_TAB_KEY);
    return value && VALID_TABS.includes(value as TabName) ? (value as TabName) : null;
  } catch {
    // Keychain unavailable (e.g. right after reboot) — treat as no preference.
    return null;
  }
};

export const saveLastTab = (tab: string) => {
  if (!VALID_TABS.includes(tab as TabName)) return;
  // Fire and forget — a failed save just means we fall back to the default next launch.
  SecureStore.setItemAsync(LAST_TAB_KEY, tab).catch(() => {});
};

export const clearSavedTab = async () => {
  try {
    await SecureStore.deleteItemAsync(LAST_TAB_KEY);
  } catch {}
};
