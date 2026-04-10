import { checkNeedsUpdate } from "./use-minimum-version";

describe("checkNeedsUpdate", () => {
  it("returns false when app version meets minimum", () => {
    expect(checkNeedsUpdate("2026.03.01", "2026.03.01")).toBe(false);
  });

  it("returns false when app version exceeds minimum", () => {
    expect(checkNeedsUpdate("2026.04.01", "2026.03.01")).toBe(false);
  });

  it("returns true when app version is below minimum", () => {
    expect(checkNeedsUpdate("2026.02.01", "2026.03.01")).toBe(true);
  });

  it("returns false when app version is undefined", () => {
    expect(checkNeedsUpdate(undefined, "2026.03.01")).toBe(false);
  });
});
