import { getBarIndexAtX } from "@/components/analytics/analytics-bar-chart";

describe("getBarIndexAtX", () => {
  it("returns null when there is no data", () => {
    expect(getBarIndexAtX(10, 0, 20, 4)).toBeNull();
  });

  it("returns null for invalid x values", () => {
    expect(getBarIndexAtX(Number.NaN, 5, 20, 4)).toBeNull();
    expect(getBarIndexAtX(Number.POSITIVE_INFINITY, 5, 20, 4)).toBeNull();
  });

  it("maps x positions to the nearest bar index", () => {
    expect(getBarIndexAtX(0, 4, 20, 4)).toBe(0);
    expect(getBarIndexAtX(11, 4, 20, 4)).toBe(0);
    expect(getBarIndexAtX(24, 4, 20, 4)).toBe(1);
    expect(getBarIndexAtX(50, 4, 20, 4)).toBe(2);
  });

  it("clamps to the first and last index when x is outside bounds", () => {
    expect(getBarIndexAtX(-100, 4, 20, 4)).toBe(0);
    expect(getBarIndexAtX(1000, 4, 20, 4)).toBe(3);
  });

  it("falls back to index 0 when stride is non-positive", () => {
    expect(getBarIndexAtX(10, 3, 0, 0)).toBe(0);
  });
});
