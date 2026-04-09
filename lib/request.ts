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

const REQUEST_TIMEOUT_MS = 30_000;
const RETRYABLE_STATUS_CODES = [502, 503, 504];
const MAX_RETRIES = 2;
const INITIAL_BACKOFF_MS = 500;

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const id = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(id);
      reject(new DOMException("The operation was aborted.", "AbortError"));
    });
  });

export const request = async <T>(
  url: string,
  options?: RequestInit & { data?: any; skipResponseBody?: boolean },
): Promise<T> => {
  const body = options?.data ? JSON.stringify(options.data) : options?.body;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
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
        if (RETRYABLE_STATUS_CODES.includes(response.status) && attempt < MAX_RETRIES) {
          console.info("HTTP request (retrying)", { ...details, attempt: attempt + 1 });
          await sleep(INITIAL_BACKOFF_MS * 2 ** attempt, options?.signal ?? undefined);
          continue;
        }

        const error =
          response.status === 403
            ? "Access denied"
            : response.status === 404
              ? "Not found"
              : (await response.text()).slice(0, 10000);
        console.info("HTTP request", { ...details, error });
        throw new Error(`Request failed: ${response.status} ${error}`);
      }
      console.info("HTTP request", details);
      if (options?.skipResponseBody) return undefined as T;
      return response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw new Error("Unreachable");
};

export const buildApiUrl = (path: string) => {
  const url = new URL(path, env.EXPO_PUBLIC_GUMROAD_API_URL);
  url.searchParams.append("mobile_token", env.EXPO_PUBLIC_MOBILE_TOKEN);
  return url.toString();
};

export const requestAPI = async <T>(
  path: string,
  options: RequestInit & { accessToken: string; data?: any; skipResponseBody?: boolean },
) =>
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
