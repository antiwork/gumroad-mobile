export const MINIMUM_ELAPSED_MS = 60 * 60 * 1000;

// Progress through the seller's current calendar day: how far along the day is (0..1)
// and how much wall-clock time has actually passed since local midnight. Both are
// needed because on daylight-saving transition days the local day is 23 or 25 hours,
// so a fraction alone can't express "at least one real hour has elapsed".
export interface DayProgress {
  fraction: number;
  elapsedMs: number;
}

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

// Progress through the seller's current calendar day, or null if the time zone can't
// be resolved. Uses the seller's zone so "today" matches the day boundaries the
// analytics backend aggregates by.
export const dayProgress = (timeZone: string, now: Date = new Date()): DayProgress | null => {
  try {
    const dayStart = localMidnightInstant(timeZone, now, 0);
    const dayEnd = localMidnightInstant(timeZone, now, 1);
    if (!Number.isFinite(dayStart) || !Number.isFinite(dayEnd) || dayEnd <= dayStart) return null;
    const elapsedMs = Math.min(Math.max(now.getTime() - dayStart, 0), dayEnd - dayStart);
    return { fraction: elapsedMs / (dayEnd - dayStart), elapsedMs };
  } catch {
    return null;
  }
};

const ordinalSuffix = (day: number): string => {
  if (day % 100 >= 11 && day % 100 <= 13) return "th";
  return { 1: "st", 2: "nd", 3: "rd" }[day % 10] ?? "th";
};

// The analytics endpoint labels day buckets like "Monday, July 20th" in the seller's
// time zone. Reproduce that label for the current day so callers can verify a bucket
// really is today before treating its total as today's revenue.
export const todaysBucketLabel = (timeZone: string, now: Date = new Date()): string | null => {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "long",
      month: "long",
      day: "numeric",
    }).formatToParts(now);
    const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
    const weekday = get("weekday");
    const month = get("month");
    const day = Number(get("day"));
    if (!weekday || !month || !Number.isFinite(day)) return null;
    return `${weekday}, ${month} ${day}${ordinalSuffix(day)}`;
  } catch {
    return null;
  }
};

// Extrapolates today's sales total (cents) to end of day using the run rate so far;
// null when a projection wouldn't be meaningful (no sales, less than an hour of real
// time elapsed, or the day is over).
export const projectedEndOfDayTotal = (totalSoFarCents: number, progress: DayProgress | null): number | null => {
  if (progress === null || progress.elapsedMs < MINIMUM_ELAPSED_MS || progress.fraction >= 1) return null;
  if (totalSoFarCents <= 0) return null;
  return Math.round(totalSoFarCents / progress.fraction);
};
