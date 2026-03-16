import { assertDefined } from "@/lib/assert";
import { useAuth } from "@/lib/auth-context";
import { requestAPI } from "@/lib/request";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect, useMemo, useState } from "react";
import { buildSearchPath, Purchase, SearchResponse } from "./use-purchases";

export const MAX_RECENT = 5;

const STORAGE_KEY = "recent_product_permalinks";
const QUERY_KEY = ["recent-products"];

const getStoredPermalinks = async (): Promise<string[]> => {
  const raw = await SecureStore.getItemAsync(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
};

const storePermalinks = async (permalinks: string[]) => {
  await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(permalinks));
};

export const useAddRecentProduct = () => {
  const queryClient = useQueryClient();

  return useCallback(
    async (purchase: Purchase) => {
      const permalinks = await getStoredPermalinks();
      const updated = [purchase.unique_permalink, ...permalinks.filter((p) => p !== purchase.unique_permalink)];
      await storePermalinks(updated.slice(0, MAX_RECENT));

      queryClient.setQueryData<Purchase[]>(QUERY_KEY, (old = []) => {
        const filtered = old.filter((p) => p.unique_permalink !== purchase.unique_permalink);
        return [purchase, ...filtered].slice(0, MAX_RECENT);
      });
    },
    [queryClient],
  );
};

export const useRecentProducts = () => {
  const { accessToken } = useAuth();
  const [permalinks, setPermalinks] = useState<string[]>([]);

  useEffect(() => {
    getStoredPermalinks().then(setPermalinks);
  }, []);

  const refresh = useCallback(async () => setPermalinks(await getStoredPermalinks()), []);

  const query = useQuery<Purchase[]>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const response = await requestAPI<SearchResponse>(buildSearchPath(1, { products: permalinks }), {
        accessToken: assertDefined(accessToken),
      });
      return response.purchases;
    },
    enabled: !!accessToken && permalinks.length > 0,
  });

  const purchases = useMemo(() => {
    if (!query.data?.length) return [];
    return [...query.data].sort(
      (a, b) => permalinks.indexOf(a.unique_permalink) - permalinks.indexOf(b.unique_permalink),
    );
  }, [query.data, permalinks]);

  return { purchases, refresh, refetch: query.refetch, isLoading: query.isLoading && permalinks.length > 0 };
};
