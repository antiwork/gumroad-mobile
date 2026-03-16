import { assertDefined } from "@/lib/assert";
import { useAuth } from "@/lib/auth-context";
import { requestAPI } from "@/lib/request";
import { QueryClient, useQuery, useQueryClient } from "@tanstack/react-query";
import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect, useMemo, useState } from "react";
import { buildSearchPath, Purchase, SearchResponse } from "./use-purchases";

const STORAGE_KEY = "recent_product_permalinks";
const MAX_RECENT = 20;
const QUERY_KEY = ["recent-products"];

const getStoredPermalinks = async (): Promise<string[]> => {
  const raw = await SecureStore.getItemAsync(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
};

const storePermalinks = async (permalinks: string[]) => {
  await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(permalinks));
};

export const addRecentProduct = async (queryClient: QueryClient, purchase: Purchase) => {
  const permalinks = await getStoredPermalinks();
  const updated = [purchase.unique_permalink, ...permalinks.filter((p) => p !== purchase.unique_permalink)].slice(
    0,
    MAX_RECENT,
  );
  await storePermalinks(updated);

  queryClient.setQueryData<Purchase[]>(QUERY_KEY, (old = []) => {
    const filtered = old.filter((p) => p.unique_permalink !== purchase.unique_permalink);
    return [purchase, ...filtered].slice(0, MAX_RECENT);
  });
};

export const useRecentProducts = () => {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const [permalinks, setPermalinks] = useState<string[]>([]);

  useEffect(() => {
    getStoredPermalinks().then(setPermalinks);
  }, []);

  const refresh = useCallback(async () => setPermalinks(await getStoredPermalinks()), []);

  const query = useQuery<Purchase[]>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const stored = await getStoredPermalinks();
      if (stored.length === 0) return [];
      const response = await requestAPI<SearchResponse>(buildSearchPath(1, { products: stored }), {
        accessToken: assertDefined(accessToken),
      });
      const map = new Map(response.purchases.map((p) => [p.unique_permalink, p]));
      return stored.map((p) => map.get(p)).filter((p): p is Purchase => !!p);
    },
    enabled: !!accessToken && permalinks.length > 0,
  });

  const purchases = useMemo(() => {
    if (!query.data?.length) return [];
    const map = new Map(query.data.map((p) => [p.unique_permalink, p]));
    return permalinks.map((p) => map.get(p)).filter((p): p is Purchase => !!p);
  }, [query.data, permalinks]);

  return { purchases, refresh, refetch: query.refetch, isLoading: query.isLoading && permalinks.length > 0 };
};
