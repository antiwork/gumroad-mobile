import { useSaleAction } from "@/components/dashboard/use-sale-actions";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react-native";
import React from "react";

jest.mock("@/lib/auth-context", () => ({ useAuth: () => ({ accessToken: "test-token" }) }));
jest.mock("@/lib/assert", () => ({ assertDefined: (value: unknown) => value }));
jest.mock("@/lib/request", () => ({ requestAPI: jest.fn(), useAPIRequest: jest.fn() }));

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(
    QueryClientProvider,
    { client: new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }) },
    children,
  );

describe("useSaleAction", () => {
  it("clears the busy guard so a later action still runs", async () => {
    const { result } = renderHook(() => useSaleAction("sale-1"), { wrapper });

    const first = jest.fn(async () => ({ success: true }));
    const second = jest.fn(async () => ({ success: true }));

    await act(async () => {
      await result.current.run(first);
    });
    await act(async () => {
      await result.current.run(second);
    });

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });
});
