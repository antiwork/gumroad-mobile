import { assertDefined } from "@/lib/assert";
import { useAuth } from "@/lib/auth-context";
import { requestAPI } from "@/lib/request";
import { useQuery } from "@tanstack/react-query";
import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect, useMemo, useState } from "react";
import { buildSearchPath, Purchase, SearchResponse } from "./use-purchases";

const STORAGE_KEY = "recent_product_permalinks";
const MAX_RECENT = 20;

const getStoredPermalinks = async (): Promise<string[]> => {
  const raw = await SecureStore.getItemAsync(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
};

const storePermalinks = async (permalinks: string[]) => {
  await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(permalinks));
};

export const addRecentProduct = async (permalink: string) => {
  const permalinks = await getStoredPermalinks();
  const updated = [permalink, ...permalinks.filter((p) => p !== permalink)].slice(0, MAX_RECENT);
  await storePermalinks(updated);
};

export const useRecentProducts = () => {
  const { accessToken } = useAuth();
  const [permalinks, setPermalinks] = useState<string[]>([]);

  useEffect(() => {
    getStoredPermalinks().then(setPermalinks);
  }, []);

  const refresh = useCallback(async () => setPermalinks(await getStoredPermalinks()), []);

  const sortedPermalinks = useMemo(() => [...permalinks].sort(), [permalinks]);

  const query = useQuery<SearchResponse>({
    queryKey: ["recent-products", sortedPermalinks],
    queryFn: () =>
      requestAPI<SearchResponse>(buildSearchPath(1, { products: sortedPermalinks }), {
        accessToken: assertDefined(accessToken),
      }),
    enabled: !!accessToken && sortedPermalinks.length > 0,
  });

  const purchases = useMemo(() => {
    if (!query.data) return [];
    const purchaseMap = new Map(query.data.purchases.map((p) => [p.unique_permalink, p]));
    return permalinks.map((permalink) => purchaseMap.get(permalink)).filter((p): p is Purchase => !!p);
  }, [query.data, permalinks]);

  return { purchases, refresh, isLoading: query.isLoading && permalinks.length > 0 };
};
