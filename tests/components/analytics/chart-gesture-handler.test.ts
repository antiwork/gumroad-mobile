import { getIndexFromX } from "./chart-gesture-handler.test.helpers";

describe("chart gesture index calculation", () => {
  const barWidth = 20;
  const spacing = 4;
  const dataLength = 7;

  it("returns 0 for tap at the start of the chart", () => {
    expect(getIndexFromX(5, barWidth, spacing, 0, dataLength)).toBe(0);
  });

  it("returns correct index for tap in the middle", () => {
    expect(getIndexFromX(75, barWidth, spacing, 0, dataLength)).toBe(3);
  });

  it("clamps to 0 for negative x", () => {
    expect(getIndexFromX(-10, barWidth, spacing, 0, dataLength)).toBe(0);
  });

  it("clamps to last index for x beyond chart width", () => {
    expect(getIndexFromX(500, barWidth, spacing, 0, dataLength)).toBe(6);
  });

  it("accounts for initialSpacing offset", () => {
    expect(getIndexFromX(30, barWidth, spacing, 20, dataLength)).toBe(0);
  });

  it("returns null for zero data length", () => {
    expect(getIndexFromX(50, barWidth, spacing, 0, 0)).toBeNull();
  });

  it("returns null for zero cell width", () => {
    expect(getIndexFromX(50, 0, 0, 0, 5)).toBeNull();
  });

  it("selects correct bar when tapping above a short bar", () => {
    const thirdBarStart = 2 * (barWidth + spacing);
    expect(getIndexFromX(thirdBarStart + 1, barWidth, spacing, 0, dataLength)).toBe(2);
  });

  it("updates selection when sliding across bars", () => {
    const indices = [];
    for (let x = 0; x < 168; x += 24) {
      indices.push(getIndexFromX(x, barWidth, spacing, 0, dataLength));
    }
    expect(indices).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});
