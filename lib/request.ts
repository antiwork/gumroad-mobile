import { env } from "@/lib/env";
import { useQuery, UseQueryOptions } from "@tanstack/react-query";
import { useEffect } from "react";
import { assertDefined } from "./assert";
import { useAuth } from "./auth-context";
export class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnauthorizedError";
  }
}

const RETRY_COUNT = 2;
const REQUEST_TIMEOUT_MS = 30_000;

const isTransientNetworkError = (error: unknown): boolean =>
  error instanceof TypeError &&
  (error.message.includes("Network request timed out") || error.message.includes("Network request failed"));

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const request = async <T>(url: string, options?: RequestInit & { data?: any }): Promise<T> => {
  const body = options?.data ? JSON.stringify(options.data) : options?.body;

  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRY_COUNT; attempt++) {
    if (attempt > 0) await sleep(1000 * 2 ** (attempt - 1));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    if (options?.signal) options.signal.addEventListener("abort", () => controller.abort());

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...options?.headers,
        },
        body,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const details = {
        // Including the token in the logged URL makes Sentry exclude the whole string. We can remove this when we use the public API
        url: url.replace(env.EXPO_PUBLIC_MOBILE_TOKEN, "[filtered]"),
        method: options?.method ?? "GET",
        status: response.status,
      };
      if (response.status === 401) {
        console.info("HTTP request", details);
        throw new UnauthorizedError("Unauthorized");
      }
      if (!response.ok) {
        const error = (await response.text()).slice(0, 10000);
        console.info("HTTP request", { ...details, error });
        throw new Error(`Request failed: ${response.status} ${error}`);
      }
      console.info("HTTP request", details);
      return response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error;
      if (!isTransientNetworkError(error)) throw error;
    }
  }
  throw lastError;
};

export const buildApiUrl = (path: string) => {
  const url = new URL(path, env.EXPO_PUBLIC_GUMROAD_API_URL);
  url.searchParams.append("mobile_token", env.EXPO_PUBLIC_MOBILE_TOKEN);
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
    if (query.error instanceof UnauthorizedError) logout();
  }, [query.error, logout]);

  return query;
};
