import { env } from "@/lib/env";

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
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Request failed: ${error}`);
  }
  return response.json();
};

export const buildApiUrl = (path: string) => {
  const url = new URL(path, env.EXPO_PUBLIC_GUMROAD_API_URL);
  url.searchParams.append("mobile_token", env.EXPO_PUBLIC_MOBILE_TOKEN);
  return url.toString();
};

export const requestAPI = async <T>(path: string, options?: RequestInit & { data?: any }) =>
  request<T>(buildApiUrl(path), options);
