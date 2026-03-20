import { assertDefined } from "@/lib/assert";
import { useAuth } from "@/lib/auth-context";
import { requestAPI } from "@/lib/request";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  const [purchaseIds, setPurchaseIds] = useState<string[]>([]);

  useEffect(() => {
    getStoredPurchaseIds().then(setPurchaseIds);
  }, []);

  const refresh = useCallback(async () => setPurchaseIds(await getStoredPurchaseIds()), []);

  const query = useQuery<Purchase[]>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const response = await requestAPI<SearchResponse>(buildSearchPath(1, { purchase_ids: purchaseIds }), {
        accessToken: assertDefined(accessToken),
      });
      return response.purchases;
    },
    enabled: !!accessToken && purchaseIds.length > 0,
  });

  const purchases = useMemo(() => {
    if (!query.data?.length) return [];
    return [...query.data].sort(
      (a, b) => purchaseIds.indexOf(a.purchase_id ?? "") - purchaseIds.indexOf(b.purchase_id ?? ""),
    );
  }, [query.data, purchaseIds]);

  return { purchases, refresh, refetch: query.refetch, isLoading: query.isLoading && purchaseIds.length > 0 };
};
