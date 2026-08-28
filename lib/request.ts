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

// On iOS, React Native's fetch backs response bodies with native Blob storage. If the app is
// suspended between the response arriving and the body being read, iOS can purge that storage,
// and reading the body then rejects with "Unable to resolve data for blob: <uuid>". The response
// is gone for good, but the request itself is perfectly retryable — so we surface it as this
// dedicated error and let the react-query retry policy refetch instead of failing the screen.
export class StaleResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StaleResponseError";
  }
}

const STALE_BLOB_MESSAGE = "Unable to resolve data for blob";

export const isStaleBlobError = (error: unknown): boolean =>
  error instanceof Error && error.message.includes(STALE_BLOB_MESSAGE);

// Reads a response body, converting a purged-blob read failure into StaleResponseError.
const readBody = async <T>(read: () => Promise<T>): Promise<T> => {
  try {
    return await read();
  } catch (error) {
    if (isStaleBlobError(error))
      throw new StaleResponseError(
        `Response body purged while app was suspended: ${error instanceof Error ? error.message : String(error)}`,
      );
    throw error;
  }
};

// A 400 with "invalid_grant" from the OAuth token endpoint means the grant (refresh token or
// authorization code) is expired or revoked — an expected end-of-session state, not a bug.
export const isInvalidGrantError = (error: unknown): boolean =>
  error instanceof RequestError && error.statusCode === 400 && error.message.includes('"invalid_grant"');

// The Gumroad API responds to requests with an invalid or expired session by redirecting to the
// login page instead of returning 401. fetch follows that redirect transparently, and /login
// doesn't exist on the API host, so the caller ends up with a 404 for a page it never asked for.
// Detecting the redirect lets us surface the real condition (unauthorized) so the token-refresh
// path can run, instead of failing the screen with a misleading "404 Not found".
//
// The final URL comes from the underlying XHR's responseURL, which React Native reports
// differently per platform: on iOS it is the URL the redirect landed on, but on Android it is
// always the URL that was requested. So this detection works on iOS only. Note also that
// React Native's fetch is the whatwg-fetch polyfill, which never sets `redirected` on a
// Response at all, so that flag cannot be used to identify a redirect here.
const isRedirectToLogin = (requestedUrl: string, finalUrl: string | undefined): boolean => {
  if (!finalUrl) return false;
  try {
    return new URL(finalUrl).pathname === "/login" && new URL(requestedUrl).pathname !== "/login";
  } catch {
    return false;
  }
};

// Everything this app requests answers in JSON, so an HTML 404 means the request never reached
// the endpoint it asked for — it was redirected to a web page that doesn't exist on that host.
// Both known ways to lose a session land here: an API read redirected to /login, and a token
// refresh whose POST was downgraded to a GET, which /oauth/token answers with an HTML 404.
// Unlike the redirect check above this needs no knowledge of the final URL, so it works on
// Android, where the XHR responseURL is always just the URL that was requested.
const isHtmlResponse = (response: Response): boolean =>
  response.headers.get("content-type")?.toLowerCase().includes("text/html") ?? false;

export const REQUEST_TIMEOUT_MS = 30_000;
const RETRY_BASE_DELAY_MS = 1_000;
const MAX_RETRY_DELAY_MS = 30_000;
const SERVER_ERROR_RETRY_DELAY_MS = 2_000;

// Gateway-class failures (502 bad gateway, 503 unavailable, 504 gateway timeout) are
// transient by nature and usually succeed on a fresh attempt. A plain 500 is excluded: it
// tends to be deterministic (a bug on one side or the other), so retrying only doubles the
// load and delays the error.
const TRANSIENT_STATUS_CODES = [502, 503, 504];

// Waits before the automatic retry, but gives up immediately if the caller aborts — a
// cancelled screen or query must never trigger a fresh network request.
const retryDelay = (ms: number, signal?: AbortSignal | null) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("The operation was aborted.", "AbortError"));
      return;
    }
    const onAbort = () => {
      clearTimeout(timeoutId);
      reject(new DOMException("The operation was aborted.", "AbortError"));
    };
    const timeoutId = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });


const screenshotFixture = (url: string): unknown => {
  if (url.includes("mobile_minimum_version")) return { minimum_version: "0.0.1" };
  if (url.includes("purchases/search"))
    return {
      success: true,
      user_id: "1",
      purchases: [
        {
          name: "Oil painting course",
          unique_permalink: "oil",
          creator_name: "Maya Chen",
          creator_username: "maya",
          creator_profile_url: "https://gumroad.com/maya",
          creator_profile_picture_url: "",
          thumbnail_url: null,
          url_redirect_token: "tok1",
          purchase_email: "you@example.com",
        },
        {
          name: "Field notes PDF",
          unique_permalink: "notes",
          creator_name: "Maya Chen",
          creator_username: "maya",
          creator_profile_url: "https://gumroad.com/maya",
          creator_profile_picture_url: "",
          thumbnail_url: null,
          url_redirect_token: "tok2",
          purchase_email: "you@example.com",
        },
        {
          name: "Late night mixes",
          unique_permalink: "mixes",
          creator_name: "Maya Chen",
          creator_username: "maya",
          creator_profile_url: "https://gumroad.com/maya",
          creator_profile_picture_url: "",
          thumbnail_url: null,
          url_redirect_token: "tok3",
          purchase_email: "you@example.com",
        },
      ],
      sellers: [{ id: "1", name: "Maya Chen", purchases_count: 3 }],
      meta: { pagination: { count: 3, items: 24, page: 1, pages: 1, prev: null, next: null, last: 1 } },
    };
  if (url.includes("v2/user")) return { success: true, user_id: "1", name: "Maya Chen", email: "maya@example.com" };
  if (url.includes("revenue_totals"))
    return {
      day: { formatted_revenue: "$1,284" },
      week: { formatted_revenue: "$4,910" },
      month: { formatted_revenue: "$18,240" },
      year: { formatted_revenue: "$96,400" },
    };
  if (url.includes("analytics/products")) return { products: [{ id: "1" }, { id: "2" }, { id: "3" }] };
  if (url.includes("analytics/sales"))
    return { success: true, sales_count: 12, formatted_revenue: "$1,284" };
  if (url.includes("mobile/products"))
    return {
      success: true,
      products: [
        {
          id: "1",
          name: "Oil painting course",
          permalink: "oil",
          price_formatted: "$49",
          status: "published",
          thumbnail_url: null,
          can_edit: true,
          can_destroy: true,
        },
        {
          id: "2",
          name: "Field notes PDF",
          permalink: "notes",
          price_formatted: "$12",
          status: "published",
          thumbnail_url: null,
          can_edit: true,
          can_destroy: true,
        },
        {
          id: "3",
          name: "Sample pack",
          permalink: "pack",
          price_formatted: "$9",
          status: "unpublished",
          thumbnail_url: null,
          can_edit: true,
          can_destroy: true,
        },
      ],
      pagination: { count: 3, page: 1, pages: 1, next: null },
    };
  if (url.includes("agent/meta")) return { success: true, enabled: true, greeting: "Hi", suggestions: [] };
  if (url.includes("agent/conversations")) return { success: false };
  return { success: true };
};

export const request = async <T>(
  url: string,
  options?: RequestInit & { data?: any; skipResponseBody?: boolean },
): Promise<T> => {
  const authHeader = String((options?.headers as { Authorization?: string } | undefined)?.Authorization ?? "");
  if (authHeader.includes("screenshot-fake-token")) return screenshotFixture(url) as T;
  // GET requests are safe to repeat, so give them one automatic retry before surfacing the
  // error; non-GET requests are not repeated here because they may have side effects —
  // their callers decide (react-query retries queries, mutations opt in).
  const method = (options?.method ?? "GET").toUpperCase();
  try {
    return await requestOnce<T>(url, options);
  } catch (error) {
    if (
      method === "GET" &&
      !options?.signal?.aborted &&
      error instanceof ServerError &&
      TRANSIENT_STATUS_CODES.includes(error.statusCode)
    ) {
      await retryDelay(SERVER_ERROR_RETRY_DELAY_MS, options?.signal);
      return requestOnce<T>(url, options);
    }
    throw error;
  }
};

const requestOnce = async <T>(
  url: string,
  options?: RequestInit & { data?: any; skipResponseBody?: boolean },
): Promise<T> => {
  const body = options?.data ? JSON.stringify(options.data) : options?.body;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  if (options?.signal) {
    if (options.signal.aborted) controller.abort();
    else options.signal.addEventListener("abort", () => controller.abort());
  }

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
    if (
      response.status === 401 ||
      isRedirectToLogin(url, response.url) ||
      (response.status === 404 && isHtmlResponse(response))
    ) {
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
            : (await readBody(() => response.text())).slice(0, 10000);
      console.info("HTTP request", { ...details, error });
      throw new RequestError(response.status, `Request failed: ${response.status} ${error}`);
    }
    console.info("HTTP request", details);
    if (options?.skipResponseBody) return undefined as T;
    return readBody(() => response.json());
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
      // A purged response body (app suspended mid-request) is always worth one fresh retry,
      // even for queries that opted out of retries — the data was never received at all.
      if (error instanceof StaleResponseError) return failureCount < 2;
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
