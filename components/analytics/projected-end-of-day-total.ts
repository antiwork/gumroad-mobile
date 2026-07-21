export const MINIMUM_ELAPSED_DAY_FRACTION = 1 / 24;

// Reads the instant's wall-clock date/time in the given zone re-encoded as UTC, so
// comparing it against the real epoch time yields the zone's UTC offset at that instant.
const wallClockAsUTC = (timeZone: string, date: Date): number => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
};

// Epoch ms of local midnight in the zone for the day containing `date`, shifted by
// `dayOffset` days; the correction loop handles daylight-saving offset changes.
const localMidnightInstant = (timeZone: string, date: Date, dayOffset: number): number => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  const targetWallClock = Date.UTC(get("year"), get("month") - 1, get("day") + dayOffset, 0, 0, 0);
  let instant = targetWallClock - (wallClockAsUTC(timeZone, date) - date.getTime());
  for (let i = 0; i < 2; i += 1) {
    instant -= wallClockAsUTC(timeZone, new Date(instant)) - targetWallClock;
  }
  return instant;
};

// Fraction of the seller's current calendar day that has elapsed (0..1), or null if
// the time zone can't be resolved. Uses the seller's zone so "today" matches the day
// boundaries the analytics backend aggregates by.
export const fractionOfDayElapsed = (timeZone: string, now: Date = new Date()): number | null => {
  try {
    const dayStart = localMidnightInstant(timeZone, now, 0);
    const dayEnd = localMidnightInstant(timeZone, now, 1);
    if (!Number.isFinite(dayStart) || !Number.isFinite(dayEnd) || dayEnd <= dayStart) return null;
    return Math.min(Math.max((now.getTime() - dayStart) / (dayEnd - dayStart), 0), 1);
  } catch {
    return null;
  }
};

// Extrapolates today's sales total (cents) to end of day using the run rate so far;
// null when a projection wouldn't be meaningful (no sales, day barely started or over).
export const projectedEndOfDayTotal = (totalSoFarCents: number, elapsedFraction: number | null): number | null => {
  if (elapsedFraction === null || elapsedFraction < MINIMUM_ELAPSED_DAY_FRACTION || elapsedFraction >= 1) return null;
  if (totalSoFarCents <= 0) return null;
  return Math.round(totalSoFarCents / elapsedFraction);
};
