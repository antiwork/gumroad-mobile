import { checkUpdateRequirement } from "./use-minimum-version";

describe("checkUpdateRequirement", () => {
  it("returns null when app version meets minimum", () => {
    expect(checkUpdateRequirement("2026.03.01", undefined, "2026.03.01", "2026-03-12")).toBeNull();
  });

  it("returns null when app version exceeds minimum", () => {
    expect(checkUpdateRequirement("2026.04.01", undefined, "2026.03.01", "2026-03-12")).toBeNull();
  });

  it("returns 'native' when app version is below minimum", () => {
    expect(checkUpdateRequirement("2026.02.01", undefined, "2026.03.01", "2026-03-12")).toBe("native");
  });

  it("returns 'ota' when update is older than minimum update date", () => {
    const oldUpdate = new Date("2026-03-01");
    expect(checkUpdateRequirement("2026.03.01", oldUpdate, "2026.03.01", "2026-03-12")).toBe("ota");
  });

  it("returns null when update meets minimum update date", () => {
    const recentUpdate = new Date("2026-03-12");
    expect(checkUpdateRequirement("2026.03.01", recentUpdate, "2026.03.01", "2026-03-12")).toBeNull();
  });

  it("returns null when update exceeds minimum update date", () => {
    const recentUpdate = new Date("2026-03-15");
    expect(checkUpdateRequirement("2026.03.01", recentUpdate, "2026.03.01", "2026-03-12")).toBeNull();
  });

  it("prioritizes native update over OTA when both are needed", () => {
    const oldUpdate = new Date("2026-01-01");
    expect(checkUpdateRequirement("2026.01.01", oldUpdate, "2026.03.01", "2026-03-12")).toBe("native");
  });

  it("returns null when app version is undefined", () => {
    expect(checkUpdateRequirement(undefined, undefined, "2026.03.01", "2026-03-12")).toBeNull();
  });

  it("skips OTA check when update date is undefined", () => {
    expect(checkUpdateRequirement("2026.03.01", undefined, "2026.03.01", "2026-03-12")).toBeNull();
  });
});
