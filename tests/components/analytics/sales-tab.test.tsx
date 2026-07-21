/* eslint-disable import/first -- jest.mock must precede imports */
import { render, screen } from "@testing-library/react-native";
import React from "react";

const mockUseAnalyticsByDate = jest.fn();
jest.mock("@/components/analytics/use-analytics-by-date", () => ({
  ...jest.requireActual("@/components/analytics/use-analytics-by-date"),
  useAnalyticsByDate: (...args: unknown[]) => mockUseAnalyticsByDate(...args),
}));

jest.mock("uniwind", () => ({
  useCSSVariable: (names: string[]) => names.map((name) => `var(${name})`),
}));

jest.mock("@/components/icon", () => ({
  LineIcon: () => null,
  SolidIcon: () => null,
}));

jest.mock("react-native-gifted-charts", () => ({
  BarChart: () => null,
}));

jest.mock("@/components/analytics/chart-gesture-handler", () => ({
  ChartGestureHandler: ({ children }: { children: React.ReactNode }) => children,
}));

import { SalesTab } from "@/components/analytics/sales-tab";
import { dayProgress } from "@/components/analytics/projected-end-of-day-total";

const analyticsResult = (overrides: Record<string, unknown> = {}) => ({
  isLoading: false,
  sellerTimeZone: "UTC",
  processedData: {
    dates: ["Sunday, July 19th", "Monday, July 20th"],
    totals: [10000, 5000],
    sales: [3, 2],
    views: [40, 25],
  },
  ...overrides,
});

describe("SalesTab projection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the projection bar and projected total for a day-grouped range ending today", () => {
    // Freeze "now" at 18:00 UTC so 75% of the day has elapsed and $50 by-now projects
    // above today's booked total.
    jest.useFakeTimers().setSystemTime(new Date("2026-07-20T18:00:00Z"));
    mockUseAnalyticsByDate.mockReturnValue(analyticsResult());

    render(<SalesTab timeRange="1w" />);

    expect(screen.getByTestId("projection-overlay")).toBeTruthy();
    const projected = Math.round(5000 / (dayProgress("UTC", new Date())?.fraction ?? 1));
    expect(screen.getByText(`$${projected / 100} projected today`)).toBeTruthy();
    jest.useRealTimers();
  });

  it("renders no projection when no bucket matches today's date", () => {
    // The response ends the day before "now" (e.g. a stale or incomplete range), so
    // the last bucket's revenue must not be projected as today's.
    jest.useFakeTimers().setSystemTime(new Date("2026-07-21T18:00:00Z"));
    mockUseAnalyticsByDate.mockReturnValue(analyticsResult());

    render(<SalesTab timeRange="1w" />);

    expect(screen.queryByTestId("projection-overlay")).toBeNull();
    expect(screen.queryByText(/projected today/u)).toBeNull();
    jest.useRealTimers();
  });

  it("shows the projected total without a bar on the hourly Today view", () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-07-20T18:00:00Z"));
    mockUseAnalyticsByDate.mockReturnValue(
      analyticsResult({
        processedData: {
          dates: ["Monday, July 20th, 12 AM", "Monday, July 20th, 1 AM"],
          totals: [3000, 2000],
          sales: [1, 1],
          views: [10, 5],
        },
      }),
    );

    render(<SalesTab timeRange="1d" />);

    expect(screen.queryByTestId("projection-overlay")).toBeNull();
    expect(screen.getByText(/projected today/u)).toBeTruthy();
    jest.useRealTimers();
  });

  it("renders no projection on the yearly view", () => {
    mockUseAnalyticsByDate.mockReturnValue(analyticsResult());

    render(<SalesTab timeRange="1y" />);

    expect(screen.queryByTestId("projection-overlay")).toBeNull();
    expect(screen.queryByText(/projected today/u)).toBeNull();
  });

  it("renders no projection when the seller time zone is unavailable", () => {
    mockUseAnalyticsByDate.mockReturnValue(analyticsResult({ sellerTimeZone: null }));

    render(<SalesTab timeRange="1w" />);

    expect(screen.queryByTestId("projection-overlay")).toBeNull();
    expect(screen.queryByText(/projected today/u)).toBeNull();
  });
});
