import { getBarIndexFromX } from "@/components/analytics/analytics-bar-chart";

describe("getBarIndexFromX", () => {
  it("returns null when there is no data", () => {
    expect(getBarIndexFromX(50, 20, 4, 0)).toBeNull();
  });

  it("clamps to first bar when x is before chart content", () => {
    expect(getBarIndexFromX(-20, 20, 4, 5)).toBe(0);
    expect(getBarIndexFromX(0, 20, 4, 5)).toBe(0);
  });

  it("maps x positions to expected bar index", () => {
    expect(getBarIndexFromX(10, 20, 4, 5)).toBe(0);
    expect(getBarIndexFromX(33, 20, 4, 5)).toBe(0);
    expect(getBarIndexFromX(34, 20, 4, 5)).toBe(1);
    expect(getBarIndexFromX(58, 20, 4, 5)).toBe(2);
  });

  it("clamps to last bar when x exceeds chart width", () => {
    expect(getBarIndexFromX(999, 20, 4, 5)).toBe(4);
  });

  it("accounts for initial spacing before first bar", () => {
    expect(getBarIndexFromX(14, 20, 4, 5, 8)).toBe(0);
    expect(getBarIndexFromX(42, 20, 4, 5, 8)).toBe(1);
  });
});
