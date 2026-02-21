import { formatCurrency, formatNumber, getBarIndexFromX } from "@/components/analytics/analytics-bar-chart";

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

  it("accounts for custom xOffset", () => {
    expect(getBarIndexFromX(20, 20, 4, 5, 0, 20)).toBe(0);
    expect(getBarIndexFromX(44, 20, 4, 5, 0, 20)).toBe(1);
  });

  it("handles single bar data", () => {
    expect(getBarIndexFromX(50, 20, 4, 1)).toBe(0);
    expect(getBarIndexFromX(999, 20, 4, 1)).toBe(0);
  });
});

describe("formatCurrency", () => {
  it("formats cents as dollars", () => {
    expect(formatCurrency(1500)).toBe("$15.00");
  });

  it("formats zero cents", () => {
    expect(formatCurrency(0)).toBe("$0.00");
  });

  it("formats thousands with K suffix", () => {
    expect(formatCurrency(150_000)).toBe("$1.5K");
  });

  it("formats millions with M suffix", () => {
    expect(formatCurrency(150_000_000)).toBe("$1.5M");
  });

  it("returns $0.00 for null", () => {
    expect(formatCurrency(null as unknown as number)).toBe("$0.00");
  });

  it("returns $0.00 for undefined", () => {
    expect(formatCurrency(undefined as unknown as number)).toBe("$0.00");
  });
});

describe("formatNumber", () => {
  it("formats small numbers", () => {
    expect(formatNumber(42)).toBe("42");
  });

  it("formats zero", () => {
    expect(formatNumber(0)).toBe("0");
  });

  it("formats thousands with K suffix", () => {
    expect(formatNumber(1500)).toBe("1.5K");
  });

  it("formats millions with M suffix", () => {
    expect(formatNumber(1_500_000)).toBe("1.5M");
  });

  it("returns 0 for null", () => {
    expect(formatNumber(null as unknown as number)).toBe("0");
  });

  it("returns 0 for undefined", () => {
    expect(formatNumber(undefined as unknown as number)).toBe("0");
  });
});
