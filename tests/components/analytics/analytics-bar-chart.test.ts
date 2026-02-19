import { getBarIndexFromX, Y_AXIS_EMPTY_LABEL_WIDTH } from "@/components/analytics/analytics-bar-chart";

describe("getBarIndexFromX", () => {
  const barWidth = 20;
  const spacing = 4;
  const dataLength = 7;
  const yAxisOffset = Y_AXIS_EMPTY_LABEL_WIDTH;

  it("returns null when dataLength is 0", () => {
    expect(getBarIndexFromX(50, barWidth, spacing, 0)).toBeNull();
  });

  it("returns 0 for taps in the first bar column", () => {
    expect(getBarIndexFromX(yAxisOffset + 5, barWidth, spacing, dataLength)).toBe(0);
  });

  it("returns the correct index for taps in a middle column", () => {
    const thirdBarStart = yAxisOffset + 2 * (barWidth + spacing);
    expect(getBarIndexFromX(thirdBarStart + 5, barWidth, spacing, dataLength)).toBe(2);
  });

  it("returns 0 for taps to the left of the chart area", () => {
    expect(getBarIndexFromX(0, barWidth, spacing, dataLength)).toBe(0);
  });

  it("clamps to the last index for taps beyond the chart area", () => {
    expect(getBarIndexFromX(500, barWidth, spacing, dataLength)).toBe(dataLength - 1);
  });

  it("returns the last index at the end of the last bar", () => {
    const lastBarEnd = yAxisOffset + (dataLength - 1) * (barWidth + spacing) + barWidth;
    expect(getBarIndexFromX(lastBarEnd - 1, barWidth, spacing, dataLength)).toBe(dataLength - 1);
  });

  it("maps taps in the spacing area to the current bar", () => {
    const spacingArea = yAxisOffset + barWidth + 1;
    expect(getBarIndexFromX(spacingArea, barWidth, spacing, dataLength)).toBe(0);
  });

  it("maps taps at the exact boundary to the next bar", () => {
    const boundary = yAxisOffset + barWidth + spacing;
    expect(getBarIndexFromX(boundary, barWidth, spacing, dataLength)).toBe(1);
  });

  it("returns null for negative dataLength", () => {
    expect(getBarIndexFromX(50, barWidth, spacing, -1)).toBeNull();
  });

  it("returns 0 for a single bar regardless of x position", () => {
    expect(getBarIndexFromX(yAxisOffset + 100, barWidth, spacing, 1)).toBe(0);
  });
});
