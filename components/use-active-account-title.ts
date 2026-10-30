import { useAuth } from "@/lib/auth-context";

export const useActiveAccountTitle = (fallback: string) => {
  const { accounts, activeAccountId } = useAuth();
  if (accounts.length < 2) return fallback;
  return accounts.find((account) => account.accountId === activeAccountId)?.name ?? fallback;
};
