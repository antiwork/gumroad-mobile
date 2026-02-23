import { formatCurrency, formatNumber, getBarIndexFromX } from "@/components/analytics/analytics-bar-chart";

describe("getBarIndexFromX", () => {
  const barWidth = 20;
  const spacing = 4;
  const dataLength = 7;

  it("returns the first bar index for a touch at the start", () => {
    expect(getBarIndexFromX(5, barWidth, spacing, dataLength)).toBe(0);
  });

  it("returns the correct bar index for a touch in the middle", () => {
    expect(getBarIndexFromX(72, barWidth, spacing, dataLength)).toBe(3);
  });

  it("returns the last bar index for a touch at the end", () => {
    expect(getBarIndexFromX(150, barWidth, spacing, dataLength)).toBe(6);
  });

  it("returns null for a negative touch position", () => {
    expect(getBarIndexFromX(-10, barWidth, spacing, dataLength)).toBeNull();
  });

  it("returns null for a touch beyond the last bar", () => {
    expect(getBarIndexFromX(200, barWidth, spacing, dataLength)).toBeNull();
  });

  it("returns null when there are no bars", () => {
    expect(getBarIndexFromX(50, barWidth, spacing, 0)).toBeNull();
  });

  it("returns the bar index when touching the spacing between bars", () => {
    const touchInSpacing = barWidth + 1;
    expect(getBarIndexFromX(touchInSpacing, barWidth, spacing, dataLength)).toBe(0);
  });

  it("returns the next bar index after a full slot width", () => {
    const slotWidth = barWidth + spacing;
    expect(getBarIndexFromX(slotWidth, barWidth, spacing, dataLength)).toBe(1);
  });
});

describe("formatCurrency", () => {
  it("formats small amounts with two decimal places", () => {
    expect(formatCurrency(999)).toBe("$9.99");
  });

  it("formats thousands with K suffix", () => {
    expect(formatCurrency(150000)).toBe("$1.5K");
  });

  it("formats millions with M suffix", () => {
    expect(formatCurrency(200000000)).toBe("$2.0M");
  });
});

describe("formatNumber", () => {
  it("formats small numbers with commas", () => {
    expect(formatNumber(42)).toBe("42");
  });

  it("formats thousands with K suffix", () => {
    expect(formatNumber(2500)).toBe("2.5K");
  });

  it("formats millions with M suffix", () => {
    expect(formatNumber(3000000)).toBe("3.0M");
  });
});
