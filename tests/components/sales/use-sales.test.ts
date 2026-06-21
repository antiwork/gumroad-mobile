import { buildSalesPath, useSales } from "@/components/sales/use-sales";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import React from "react";

const mockRequestAPI = jest.fn();
jest.mock("@/lib/request", () => ({
  requestAPI: (...args: unknown[]) => mockRequestAPI(...args),
}));

jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ accessToken: "test-token" }),
}));

jest.mock("@/lib/assert", () => ({
  assertDefined: <T>(value: T) => value,
}));

const makeResponse = () => ({
  success: true,
  purchases: [{ id: "sale-1" }],
  pagination: { count: 1, page: 1, pages: 1, next: null },
});

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  Wrapper.displayName = "Wrapper";
  return Wrapper;
};

describe("buildSalesPath", () => {
  it("builds the path without a query", () => {
    expect(buildSalesPath(1, "")).toBe("mobile/sales.json?page=1");
  });

  it("encodes the query parameter", () => {
    expect(buildSalesPath(2, "buyer@example.com")).toBe("mobile/sales.json?page=2&query=buyer%40example.com");
  });
});

describe("useSales", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("does not fetch with empty input when requireQuery is set", async () => {
    renderHook(() => useSales("", true, { requireQuery: true }), { wrapper: createWrapper() });
    await act(async () => {
      jest.advanceTimersByTime(600);
    });
    expect(mockRequestAPI).not.toHaveBeenCalled();
  });

  it("fetches once input is non-empty when requireQuery is set", async () => {
    mockRequestAPI.mockResolvedValue(makeResponse());
    const { result } = renderHook(() => useSales("widget", true, { requireQuery: true }), { wrapper: createWrapper() });
    await act(async () => {
      jest.advanceTimersByTime(600);
    });
    await waitFor(() => expect(result.current.sales).toHaveLength(1));
    expect(mockRequestAPI).toHaveBeenCalledWith(
      expect.stringContaining("query=widget"),
      expect.objectContaining({ accessToken: "test-token" }),
    );
  });

  it("fetches with empty input when requireQuery is not set", async () => {
    mockRequestAPI.mockResolvedValue(makeResponse());
    const { result } = renderHook(() => useSales("", true), { wrapper: createWrapper() });
    await act(async () => {
      jest.advanceTimersByTime(600);
    });
    await waitFor(() => expect(result.current.sales).toHaveLength(1));
    expect(mockRequestAPI).toHaveBeenCalledWith("mobile/sales.json?page=1", expect.anything());
  });

  it("does not fetch while disabled", async () => {
    renderHook(() => useSales("widget", false, { requireQuery: true }), { wrapper: createWrapper() });
    await act(async () => {
      jest.advanceTimersByTime(600);
    });
    expect(mockRequestAPI).not.toHaveBeenCalled();
  });
});
