import { getBarIndex } from "@/components/analytics/chart-gesture-wrapper";

const BAR_WIDTH = 20;
const SPACING = 4;
const BAR_COUNT = 7;

describe("getBarIndex", () => {
  it("returns index 0 for a tap at the start of the chart", () => {
    expect(getBarIndex(5, BAR_WIDTH, SPACING, BAR_COUNT)).toBe(0);
  });

  it("returns the correct index for a tap in the middle", () => {
    expect(getBarIndex(72, BAR_WIDTH, SPACING, BAR_COUNT)).toBe(3);
  });

  it("returns the last index for a tap near the end", () => {
    expect(getBarIndex(150, BAR_WIDTH, SPACING, BAR_COUNT)).toBe(6);
  });

  it("returns null for a tap beyond all bars", () => {
    expect(getBarIndex(200, BAR_WIDTH, SPACING, BAR_COUNT)).toBeNull();
  });

  it("returns null for a negative x position", () => {
    expect(getBarIndex(-10, BAR_WIDTH, SPACING, BAR_COUNT)).toBeNull();
  });

  it("returns null when barCount is 0", () => {
    expect(getBarIndex(10, BAR_WIDTH, SPACING, 0)).toBeNull();
  });

  it("returns null when bar slot width is 0", () => {
    expect(getBarIndex(10, 0, 0, 5)).toBeNull();
  });

  it("handles narrow bars correctly", () => {
    expect(getBarIndex(13, 4, 2, 10)).toBe(2);
  });
});
