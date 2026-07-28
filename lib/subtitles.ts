export type SubtitleCue = {
  start: number;
  end: number;
  text: string;
};

const TIMESTAMP = /(?:(\d{1,2}):)?(\d{1,2}):(\d{1,2})[.,](\d{1,3})/;

const SRT_VTT_TIMING_LINE = new RegExp(`^\\s*(${TIMESTAMP.source})\\s*-->\\s*(${TIMESTAMP.source})`);

const SBV_TIMING_LINE = new RegExp(`^\\s*(${TIMESTAMP.source})\\s*,\\s*(${TIMESTAMP.source})\\s*$`);

const SUBTITLE_ENTITIES: Record<string, string> = {
  amp: "&",
  gt: ">",
  lrm: "\u200E",
  lt: "<",
  nbsp: "\u00A0",
  rlm: "\u200F",
};

const parseTimestamp = (raw: string): number | null => {
  const match = TIMESTAMP.exec(raw);
  if (!match) return null;
  const [, hours, minutes, seconds, fraction] = match;
  return Number(hours ?? 0) * 3600 + Number(minutes) * 60 + Number(seconds) + Number(fraction) / 10 ** fraction.length;
};

const stripMarkup = (text: string): string =>
  text
    .replace(/<[^>]*>/gu, "")
    .replace(/\{[^}]*\}/gu, "")
    .replace(/&(amp|gt|lrm|lt|nbsp|rlm);/giu, (_, entity: string) => SUBTITLE_ENTITIES[entity.toLowerCase()]);

const normalize = (raw: string): string => raw.replace(/^\uFEFF/u, "").replace(/\r\n?/gu, "\n");

export const parseSubtitles = (content: string): SubtitleCue[] => {
  const blocks = normalize(content)
    .split(/\n{2,}/u)
    .map((block) => block.trim())
    .filter(Boolean);

  const cues: SubtitleCue[] = [];
  for (const block of blocks) {
    const lines = block.split("\n");
    const timingIndex = lines.findIndex((line) => SRT_VTT_TIMING_LINE.test(line) || SBV_TIMING_LINE.test(line));
    if (timingIndex === -1) continue;

    const timingLine = lines[timingIndex];
    const [startRaw, endRaw] = SRT_VTT_TIMING_LINE.test(timingLine) ? timingLine.split("-->") : timingLine.split(",");
    const start = parseTimestamp(startRaw);
    const end = parseTimestamp(endRaw ?? "");
    if (start == null || end == null || end <= start) continue;

    const text = stripMarkup(
      lines
        .slice(timingIndex + 1)
        .join("\n")
        .trim(),
    ).trim();
    if (!text) continue;

    cues.push({ start, end, text });
  }

  return cues.sort((a, b) => a.start - b.start);
};

export const activeCueText = (cues: SubtitleCue[], time: number): string | null => {
  const active = cues.filter((cue) => time >= cue.start && time < cue.end);
  if (active.length === 0) return null;
  return active.map((cue) => cue.text).join("\n");
};
