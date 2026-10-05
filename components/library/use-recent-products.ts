import { assertDefined } from "@/lib/assert";
import { useAuth } from "@/lib/auth-context";
import { isEmailUnconfirmedError, shouldRetry } from "@/lib/email-confirmation";
import { requestAPI } from "@/lib/request";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as SecureStore from "expo-secure-store";
import { useCallback } from "react";
import { buildSearchPath, Purchase, SearchResponse } from "./use-purchases";

export const MAX_RECENT = 5;

const STORAGE_KEY = "recent_purchase_ids";
const QUERY_KEY = ["recent-products"];

const getStoredPurchaseIds = async (): Promise<string[]> => {
  const raw = await SecureStore.getItemAsync(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
};

const storePurchaseIds = async (ids: string[]) => {
  await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(ids));
};

export const useAddRecentPurchase = () => {
  const queryClient = useQueryClient();

  return useCallback(
    async (purchase: Purchase) => {
      if (!purchase.purchase_id) return;
      const ids = await getStoredPurchaseIds();
      const updated = [purchase.purchase_id, ...ids.filter((id) => id !== purchase.purchase_id)];
      await storePurchaseIds(updated.slice(0, MAX_RECENT));

      queryClient.setQueryData<Purchase[]>(QUERY_KEY, (old = []) => {
        const filtered = old.filter((p) => p.purchase_id !== purchase.purchase_id);
        return [purchase, ...filtered].slice(0, MAX_RECENT);
      });
    },
    [queryClient],
  );
};

export const useRecentPurchases = () => {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const defaultRetry = queryClient.getDefaultOptions().queries?.retry;

  const query = useQuery<Purchase[]>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const purchaseIds = await getStoredPurchaseIds();
      if (purchaseIds.length === 0) return [];
      const response = await requestAPI<SearchResponse>(
        buildSearchPath(1, { purchase_ids: purchaseIds, archived: false }),
        { accessToken: assertDefined(accessToken) },
      );
      return [...response.purchases].sort(
        (a, b) => purchaseIds.indexOf(a.purchase_id ?? "") - purchaseIds.indexOf(b.purchase_id ?? ""),
      );
    },
    enabled: !!accessToken,
    retry: (failureCount, error) => !isEmailUnconfirmedError(error) && shouldRetry(defaultRetry, failureCount, error),
  });

  return {
    purchases: query.data ?? [],
    refresh: query.refetch,
    refetch: query.refetch,
    isLoading: query.isLoading,
  };
};
