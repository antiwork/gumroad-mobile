import {
  formatCurrency,
  formatNumber,
  getBarIndex,
  CHART_LEFT_OFFSET,
} from "@/components/analytics/analytics-bar-chart";

describe("formatCurrency", () => {
  it("formats cents as dollars", () => {
    expect(formatCurrency(1500)).toBe("$15.00");
  });

  it("formats thousands with K suffix", () => {
    expect(formatCurrency(150_000)).toBe("$1.5K");
  });

  it("formats millions with M suffix", () => {
    expect(formatCurrency(150_000_000)).toBe("$1.5M");
  });

  it("formats zero", () => {
    expect(formatCurrency(0)).toBe("$0.00");
  });

  it("returns $0.00 for null", () => {
    expect(formatCurrency(null as unknown as number)).toBe("$0.00");
  });

  it("returns $0.00 for undefined", () => {
    expect(formatCurrency(undefined as unknown as number)).toBe("$0.00");
  });
});

describe("formatNumber", () => {
  it("formats small numbers with locale string", () => {
    expect(formatNumber(42)).toBe("42");
  });

  it("formats thousands with K suffix", () => {
    expect(formatNumber(1500)).toBe("1.5K");
  });

  it("formats millions with M suffix", () => {
    expect(formatNumber(1_500_000)).toBe("1.5M");
  });

  it("formats zero", () => {
    expect(formatNumber(0)).toBe("0");
  });

  it("returns 0 for null", () => {
    expect(formatNumber(null as unknown as number)).toBe("0");
  });

  it("returns 0 for undefined", () => {
    expect(formatNumber(undefined as unknown as number)).toBe("0");
  });
});

describe("getBarIndex", () => {
  const barWidth = 20;
  const spacing = 4;
  const dataLength = 7;

  it("returns 0 for tap at the left edge", () => {
    expect(getBarIndex(CHART_LEFT_OFFSET, barWidth, spacing, dataLength)).toBe(0);
  });

  it("maps x position to correct bar index", () => {
    const step = barWidth + spacing;
    const x = CHART_LEFT_OFFSET + step * 3;
    expect(getBarIndex(x, barWidth, spacing, dataLength)).toBe(3);
  });

  it("rounds to nearest bar", () => {
    const step = barWidth + spacing;
    const x = CHART_LEFT_OFFSET + step * 2.4;
    expect(getBarIndex(x, barWidth, spacing, dataLength)).toBe(2);
  });

  it("clamps to 0 for negative x", () => {
    expect(getBarIndex(-100, barWidth, spacing, dataLength)).toBe(0);
  });

  it("clamps to last index for x beyond chart", () => {
    expect(getBarIndex(9999, barWidth, spacing, dataLength)).toBe(6);
  });

  it("returns 0 when dataLength is 1", () => {
    expect(getBarIndex(CHART_LEFT_OFFSET + 50, barWidth, spacing, 1)).toBe(0);
  });
});
