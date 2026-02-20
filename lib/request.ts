import { env } from "@/lib/env";
import { useInfiniteQuery, useQuery, UseQueryOptions } from "@tanstack/react-query";
import { useEffect } from "react";
import { assertDefined } from "./assert";
import { useAuth } from "./auth-context";

export class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export const request = async <T>(url: string, options?: RequestInit & { data?: any }): Promise<T> => {
  const body = options?.data ? JSON.stringify(options.data) : options?.body;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    body,
  });
  if (response.status === 401) {
    throw new UnauthorizedError("Unauthorized");
  }
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Request failed: ${response.status} ${error}`);
  }
  return response.json();
};

export const buildApiUrl = (path: string, params?: Record<string, string | string[]>) => {
  const url = new URL(path, env.EXPO_PUBLIC_GUMROAD_API_URL);
  url.searchParams.append("mobile_token", env.EXPO_PUBLIC_MOBILE_TOKEN);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (Array.isArray(value)) {
        for (const v of value) url.searchParams.append(key, v);
      } else {
        url.searchParams.append(key, value);
      }
    }
  }
  return url.toString();
};

export const requestAPI = async <T>(path: string, options: RequestInit & { accessToken: string; data?: any }) =>
  request<T>(buildApiUrl(path), {
    ...options,
    headers: { Authorization: `Bearer ${options?.accessToken}`, ...options?.headers },
  });

export const useAPIRequest = <TResponse, TData = TResponse>(
  options: Omit<UseQueryOptions<TResponse, Error, TData>, "queryFn"> & { url: string },
) => {
  const { accessToken, logout, isLoading: isAuthLoading } = useAuth();

  const query = useQuery<TResponse, Error, TData>({
    queryFn: () => requestAPI<TResponse>(options.url, { accessToken: assertDefined(accessToken) }),
    ...options,
    enabled: !!accessToken && (options.enabled ?? true),
  });

  useEffect(() => {
    if ((!isAuthLoading && !accessToken) || query.error instanceof UnauthorizedError) logout();
  }, [isAuthLoading, accessToken, query.error, logout]);

  return query;
};

export const useInfiniteAPIRequest = <TResponse>(options: {
  queryKey: unknown[];
  url: string;
  params?: Record<string, string | string[]>;
  getNextPageParam: (lastPage: TResponse) => number | undefined;
}) => {
  const { accessToken, logout, isLoading: isAuthLoading } = useAuth();

  const query = useInfiniteQuery<TResponse, Error>({
    queryKey: options.queryKey,
    queryFn: ({ pageParam }) => {
      const pageParams = { ...options.params, page: String(pageParam) };
      return request<TResponse>(buildApiUrl(options.url, pageParams), {
        headers: { Authorization: `Bearer ${assertDefined(accessToken)}` },
      });
    },
    initialPageParam: 1,
    getNextPageParam: options.getNextPageParam,
    enabled: !!accessToken,
  });

  useEffect(() => {
    if ((!isAuthLoading && !accessToken) || query.error instanceof UnauthorizedError) logout();
  }, [isAuthLoading, accessToken, query.error, logout]);

  return query;
};
