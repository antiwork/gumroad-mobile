import {
  dayProgress,
  MINIMUM_ELAPSED_MS,
  projectedEndOfDayTotal,
  todaysBucketLabel,
} from "@/components/analytics/projected-end-of-day-total";

describe("dayProgress", () => {
  it("returns the elapsed fraction and elapsed time of the day in the given time zone", () => {
    expect(dayProgress("UTC", new Date("2026-07-16T18:00:00Z"))?.fraction).toBeCloseTo(0.75);
    expect(dayProgress("UTC", new Date("2026-07-16T18:00:00Z"))?.elapsedMs).toBe(18 * 60 * 60 * 1000);
    expect(dayProgress("America/Los_Angeles", new Date("2026-07-16T18:00:00Z"))?.fraction).toBeCloseTo(11 / 24);
  });

  it("handles midnight as zero elapsed", () => {
    expect(dayProgress("UTC", new Date("2026-07-16T00:00:00Z"))?.fraction).toBe(0);
    expect(dayProgress("UTC", new Date("2026-07-16T00:00:00Z"))?.elapsedMs).toBe(0);
  });

  it("uses the real day length on a spring-forward DST day (23 hours)", () => {
    const progress = dayProgress("America/Los_Angeles", new Date("2026-03-08T19:00:00Z"));
    expect(progress?.fraction).toBeCloseTo(11 / 23);
    expect(progress?.elapsedMs).toBe(11 * 60 * 60 * 1000);
  });

  it("uses the real day length on a fall-back DST day (25 hours)", () => {
    const progress = dayProgress("America/Los_Angeles", new Date("2026-11-01T20:00:00Z"));
    expect(progress?.fraction).toBeCloseTo(13 / 25);
    expect(progress?.elapsedMs).toBe(13 * 60 * 60 * 1000);
  });

  it("returns null for an unknown time zone", () => {
    expect(dayProgress("Not/AZone", new Date())).toBeNull();
  });
});

describe("todaysBucketLabel", () => {
  it("matches the backend's day bucket label format", () => {
    expect(todaysBucketLabel("UTC", new Date("2026-07-20T12:00:00Z"))).toBe("Monday, July 20th");
    expect(todaysBucketLabel("UTC", new Date("2026-07-01T12:00:00Z"))).toBe("Wednesday, July 1st");
    expect(todaysBucketLabel("UTC", new Date("2026-07-03T12:00:00Z"))).toBe("Friday, July 3rd");
    expect(todaysBucketLabel("UTC", new Date("2026-07-11T12:00:00Z"))).toBe("Saturday, July 11th");
    expect(todaysBucketLabel("UTC", new Date("2026-07-22T12:00:00Z"))).toBe("Wednesday, July 22nd");
  });

  it("uses the seller's time zone for the current day", () => {
    // 01:00 UTC on the 21st is still the evening of the 20th in Los Angeles.
    expect(todaysBucketLabel("America/Los_Angeles", new Date("2026-07-21T01:00:00Z"))).toBe("Monday, July 20th");
  });

  it("returns null for an unknown time zone", () => {
    expect(todaysBucketLabel("Not/AZone", new Date())).toBeNull();
  });
});

describe("projectedEndOfDayTotal", () => {
  const progress = (fraction: number, elapsedMs = fraction * 24 * 60 * 60 * 1000) => ({ fraction, elapsedMs });

  it("extrapolates the current total using the run rate so far", () => {
    expect(projectedEndOfDayTotal(720000, progress(0.75))).toBe(960000);
    expect(projectedEndOfDayTotal(100000, progress(0.5))).toBe(200000);
  });

  it("returns null until a real hour has elapsed, regardless of day length", () => {
    expect(projectedEndOfDayTotal(720000, progress(0.1, MINIMUM_ELAPSED_MS - 1))).toBeNull();
    expect(projectedEndOfDayTotal(720000, progress(0.1, MINIMUM_ELAPSED_MS))).not.toBeNull();
  });

  it("returns null when the day is over or the progress is unknown", () => {
    expect(projectedEndOfDayTotal(720000, progress(1))).toBeNull();
    expect(projectedEndOfDayTotal(720000, null)).toBeNull();
  });

  it("returns null when there are no sales yet", () => {
    expect(projectedEndOfDayTotal(0, progress(0.5))).toBeNull();
  });
});
