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

export class SessionExpiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SessionExpiredError";
  }
}

export class KeychainUnavailableError extends Error {
  constructor() {
    super("Keychain unavailable");
    this.name = "KeychainUnavailableError";
  }
}

export class ServerError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "ServerError";
    this.statusCode = statusCode;
  }
}

export class RequestError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "RequestError";
    this.statusCode = statusCode;
  }
}

export const REQUEST_TIMEOUT_MS = 30_000;
const RETRY_BASE_DELAY_MS = 1_000;
const MAX_RETRY_DELAY_MS = 30_000;

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
    if (response.status >= 500) {
      console.info("HTTP request", { ...details, error: "Server error" });
      throw new ServerError(response.status, `Request failed: ${response.status}`);
    }
    if (!response.ok) {
      const error =
        response.status === 403
          ? "Access denied"
          : response.status === 404
            ? "Not found"
            : (await response.text()).slice(0, 10000);
      console.info("HTTP request", { ...details, error });
      throw new RequestError(response.status, `Request failed: ${response.status} ${error}`);
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
          if (refreshError instanceof KeychainUnavailableError) throw error;
          if (refreshError instanceof UnauthorizedError || refreshError instanceof SessionExpiredError) {
            console.warn(refreshError);
          } else {
            Sentry.captureException(refreshError, { tags: { auth_path: "refresh_failed" } });
          }
          await logout();
          throw error;
        }
        return await requestAPI<TResponse>(options.url, { accessToken: newAccessToken });
      }
    },
    ...options,
    retry: (failureCount, error) => {
      if (error instanceof UnauthorizedError) return false;
      if (error.name === "AbortError") return false;
      const callerRetry = options.retry;
      if (callerRetry === undefined) return failureCount < 2;
      if (typeof callerRetry === "boolean") return callerRetry;
      if (typeof callerRetry === "number") return failureCount < callerRetry;
      return callerRetry(failureCount, error);
    },
    retryDelay: (attemptIndex, error) => {
      if (error instanceof ServerError) {
        return Math.min(RETRY_BASE_DELAY_MS * 2 ** attemptIndex, MAX_RETRY_DELAY_MS);
      }
      const callerRetryDelay = options.retryDelay;
      if (typeof callerRetryDelay === "function") return callerRetryDelay(attemptIndex, error);
      if (typeof callerRetryDelay === "number") return callerRetryDelay;
      return Math.min(RETRY_BASE_DELAY_MS * 2 ** attemptIndex, MAX_RETRY_DELAY_MS);
    },
    enabled: !!accessToken && (options.enabled ?? true),
  });
};
