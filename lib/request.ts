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
