import {
  getGroupBy,
  sumByDateIndex,
  processDateData,
  AnalyticsByDateResponse,
} from "@/components/analytics/use-analytics-by-date";

describe("getGroupBy", () => {
  it('returns "day" for "1w"', () => {
    expect(getGroupBy("1w")).toBe("day");
  });

  it('returns "day" for "1m"', () => {
    expect(getGroupBy("1m")).toBe("day");
  });

  it('returns "month" for "1y"', () => {
    expect(getGroupBy("1y")).toBe("month");
  });

  it('returns "month" for "all"', () => {
    expect(getGroupBy("all")).toBe("month");
  });
});

describe("sumByDateIndex", () => {
  it("sums values across multiple products", () => {
    const data = {
      product1: [10, 20, 30],
      product2: [5, 15, 25],
    };
    expect(sumByDateIndex(data, 3)).toEqual([15, 35, 55]);
  });

  it("handles missing values with nullish coalescing", () => {
    const data = {
      product1: [10, 20],
      product2: [5],
    };
    expect(sumByDateIndex(data, 3)).toEqual([15, 20, 0]);
  });

  it("returns zeros for empty input", () => {
    expect(sumByDateIndex({}, 3)).toEqual([0, 0, 0]);
  });

  it("returns empty array for zero dateCount", () => {
    expect(sumByDateIndex({ product1: [10] }, 0)).toEqual([]);
  });
});

describe("processDateData", () => {
  it("returns empty arrays for undefined input", () => {
    expect(processDateData(undefined)).toEqual({
      dates: [],
      totals: [],
      sales: [],
      views: [],
    });
  });

  it("processes a full response correctly", () => {
    const response: AnalyticsByDateResponse = {
      success: true,
      dates: ["2024-01-01", "2024-01-02"],
      by_date: {
        totals: {
          productA: [100, 200],
          productB: [50, 75],
        },
        sales: {
          productA: [1, 2],
          productB: [3, 4],
        },
        views: {
          productA: [10, 20],
          productB: [30, 40],
        },
      },
    };

    expect(processDateData(response)).toEqual({
      dates: ["2024-01-01", "2024-01-02"],
      totals: [150, 275],
      sales: [4, 6],
      views: [40, 60],
    });
  });

  it("handles response with empty product data", () => {
    const response: AnalyticsByDateResponse = {
      success: true,
      dates: ["2024-01-01"],
      by_date: {
        totals: {},
        sales: {},
        views: {},
      },
    };

    expect(processDateData(response)).toEqual({
      dates: ["2024-01-01"],
      totals: [0],
      sales: [0],
      views: [0],
    });
  });
});
