import { assertDefined } from "@/lib/assert";
import { useAuth } from "@/lib/auth-context";
import { requestAPI } from "@/lib/request";
import { useQuery } from "@tanstack/react-query";
import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Purchase, SearchResponse } from "./use-purchases";

const STORAGE_KEY = "recent_product_ids";
const MAX_RECENT = 20;

const buildRecentPath = (productIds: string[]) => {
  const params = new URLSearchParams();
  for (const id of productIds) params.append("products[]", id);
  return `mobile/purchases/search?${params.toString()}`;
};

const getStoredIds = async (): Promise<string[]> => {
  const raw = await SecureStore.getItemAsync(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
};

const storeIds = async (ids: string[]) => {
  await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(ids));
};

export const addRecentProduct = async (productId: string) => {
  const ids = await getStoredIds();
  const updated = [productId, ...ids.filter((id) => id !== productId)].slice(0, MAX_RECENT);
  await storeIds(updated);
};

export const useRecentProductIds = () => {
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    getStoredIds().then(setIds);
  }, []);

  const refresh = useCallback(async () => setIds(await getStoredIds()), []);

  return { ids, refresh };
};

export const useRecentProducts = () => {
  const { accessToken } = useAuth();
  const { ids, refresh } = useRecentProductIds();

  const query = useQuery<SearchResponse>({
    queryKey: ["recent-products", ids],
    queryFn: () =>
      requestAPI<SearchResponse>(buildRecentPath(ids), {
        accessToken: assertDefined(accessToken),
      }),
    enabled: !!accessToken && ids.length > 0,
  });

  const purchases = useMemo(() => {
    if (!query.data) return [];
    const purchaseMap = new Map(query.data.purchases.map((p) => [p.product_id, p]));
    return ids.map((id) => purchaseMap.get(id)).filter((p): p is Purchase => !!p);
  }, [query.data, ids]);

  return { purchases, refresh, isLoading: query.isLoading && ids.length > 0 };
};
