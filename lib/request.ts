import { env } from "@/lib/env";
import * as Sentry from "@sentry/react-native";
import { useQuery, UseQueryOptions } from "@tanstack/react-query";
import { assertDefined } from "./assert";
import { useAuth } from "./auth-context";
export class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class KeychainUnavailableError extends Error {
  constructor() {
    super("Keychain unavailable");
    this.name = "KeychainUnavailableError";
  }
}

const REQUEST_TIMEOUT_MS = 30_000;

export const request = async <T>(
  url: string,
  options?: RequestInit & { data?: any; skipResponseBody?: boolean },
): Promise<T> => {
  const body = options?.data ? JSON.stringify(options.data) : options?.body;

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
  const { accessToken, refreshToken, logout } = useAuth();

  return useQuery<TResponse, Error, TData>({
    queryFn: async () => {
      try {
        return await requestAPI<TResponse>(options.url, { accessToken: assertDefined(accessToken) });
      } catch (error) {
        if (!(error instanceof UnauthorizedError)) throw error;
        let newAccessToken: string;
        try {
          newAccessToken = await refreshToken();
        } catch (refreshError) {
          // Keychain temporarily inaccessible (locked device, background fetch,
          // legacy WhenUnlocked entry). Don't log out — the session is intact,
          // we just couldn't read the refresh token. Surface the original 401.
          if (refreshError instanceof KeychainUnavailableError) throw error;
          Sentry.captureException(refreshError, { tags: { auth_path: "refresh_failed" } });
          await logout();
          throw error;
        }
        // Retry once with the refreshed token. If this 401s again (e.g., token's
        // scopes are stuck and the new endpoint requires more), propagate the
        // error rather than logging the user out — refresh doesn't upgrade scopes,
        // so logout wouldn't help anyway. Transient retry failures (5xx, network)
        // also surface to the caller instead of nuking the session.
        return await requestAPI<TResponse>(options.url, { accessToken: newAccessToken });
      }
    },
    // The production QueryClient sets `retry: 2`. Without this override, an
    // UnauthorizedError thrown after our internal refresh-retry would re-enter
    // queryFn via TanStack's retry loop and trigger another refresh exchange.
    // Doorkeeper rotates the refresh token on every exchange, so a single
    // scope-stuck 401 would burn 3 rotations. The inflight-dedup only covers
    // concurrent callers within one queryFn invocation, not sequential retries.
    // 5xx/network errors still use whatever backoff the caller (or default) sets.
    retry: (failureCount, error) => {
      if (error instanceof UnauthorizedError) return false;
      return failureCount < 2;
    },
    ...options,
    enabled: !!accessToken && (options.enabled ?? true),
  });
};
