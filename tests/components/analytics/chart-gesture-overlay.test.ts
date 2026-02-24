import { getBarIndexFromX } from "@/components/analytics/chart-gesture-overlay";

describe("getBarIndexFromX", () => {
  const barWidth = 20;
  const spacing = 4;

  it("returns null when dataLength is 0", () => {
    expect(getBarIndexFromX(50, barWidth, spacing, 0)).toBeNull();
  });

  it("returns 0 for a tap on the first bar", () => {
    expect(getBarIndexFromX(10, barWidth, spacing, 7)).toBe(0);
  });

  it("returns the correct index for a tap in the middle", () => {
    // bar 2 starts at (20+4)*2 = 48
    expect(getBarIndexFromX(50, barWidth, spacing, 7)).toBe(2);
  });

  it("clamps to 0 for negative X", () => {
    expect(getBarIndexFromX(-10, barWidth, spacing, 7)).toBe(0);
  });

  it("clamps to last index for X beyond chart width", () => {
    expect(getBarIndexFromX(9999, barWidth, spacing, 7)).toBe(6);
  });

  it("returns last index when tapping on the last bar", () => {
    // bar 6 starts at (20+4)*6 = 144
    expect(getBarIndexFromX(150, barWidth, spacing, 7)).toBe(6);
  });

  it("handles single bar correctly", () => {
    expect(getBarIndexFromX(5, barWidth, spacing, 1)).toBe(0);
    expect(getBarIndexFromX(100, barWidth, spacing, 1)).toBe(0);
  });
});
