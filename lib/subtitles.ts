import { decodeHTMLStrict } from "entities";

export type SubtitleCue = {
  start: number;
  end: number;
  text: string;
};

export const MAX_SUBTITLE_CUES = 20_000;
export const MAX_ACTIVE_SUBTITLE_CUES = 4;
export const MAX_ACTIVE_SUBTITLE_CHARACTERS = 2_000;

const TIMESTAMP = /(?:(\d{1,2}):)?(\d{1,2}):(\d{1,2})[.,](\d{1,3})/;

const SRT_VTT_TIMING_LINE = new RegExp(`^\\s*(${TIMESTAMP.source})\\s*-->\\s*(${TIMESTAMP.source})`);

const SBV_TIMING_LINE = new RegExp(`^\\s*(${TIMESTAMP.source})\\s*,\\s*(${TIMESTAMP.source})\\s*$`);

const MICRODVD_TIMING_LINE = /^\{(\d+)\}\{(\d*)\}(.*)$/u;

const MICRODVD_STYLE_TAG = /\{(?:[yY]:[bius]+|[fF]:[^}]+|[sS]:\d+|[cC]:\$?[0-9a-f]{6})\}/giu;

const DEFAULT_MICRODVD_FRAMES_PER_SECOND = 25;

const parseTimestamp = (raw: string): number | null => {
  const match = TIMESTAMP.exec(raw);
  if (!match) return null;
  const [, hours, minutes, seconds, fraction] = match;
  return Number(hours ?? 0) * 3600 + Number(minutes) * 60 + Number(seconds) + Number(fraction) / 10 ** fraction.length;
};

const stripMarkup = (text: string): string =>
  decodeHTMLStrict(text.replace(/<[^>]*>/gu, "").replace(/\[br\]/giu, "\n"));

const normalize = (raw: string): string => raw.replace(/^\uFEFF/u, "").replace(/\r\n?/gu, "\n");

const parseMicroDvd = (content: string): SubtitleCue[] => {
  let framesPerSecond = DEFAULT_MICRODVD_FRAMES_PER_SECOND;
  const cues: SubtitleCue[] = [];

  for (const line of content.split("\n")) {
    const match = MICRODVD_TIMING_LINE.exec(line.trim());
    if (!match) continue;
    const [, startFrameRaw, endFrameRaw, rawText] = match;
    const startFrame = Number(startFrameRaw);
    const endFrame = Number(endFrameRaw);
    const declaredFramesPerSecond = Number(rawText);

    if (startFrame === endFrame && Number.isFinite(declaredFramesPerSecond) && declaredFramesPerSecond > 0) {
      framesPerSecond = declaredFramesPerSecond;
      continue;
    }
    if (!endFrameRaw || endFrame <= startFrame) continue;

    const text = stripMarkup(rawText.replace(MICRODVD_STYLE_TAG, "").replace(/\|/gu, "\n")).trim();
    if (!text) continue;
    if (cues.length >= MAX_SUBTITLE_CUES) throw new Error(`Subtitle track exceeds the ${MAX_SUBTITLE_CUES}-cue limit`);
    cues.push({ start: startFrame / framesPerSecond, end: endFrame / framesPerSecond, text });
  }

  return cues.sort((a, b) => a.start - b.start);
};

export const parseSubtitles = (content: string): SubtitleCue[] => {
  const normalizedContent = normalize(content);
  const microDvdCues = parseMicroDvd(normalizedContent);
  if (microDvdCues.length > 0) return microDvdCues;

  const blocks = normalizedContent
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

    if (cues.length >= MAX_SUBTITLE_CUES) throw new Error(`Subtitle track exceeds the ${MAX_SUBTITLE_CUES}-cue limit`);
    cues.push({ start, end, text });
  }

  return cues.sort((a, b) => a.start - b.start);
};

export const activeCueText = (cues: SubtitleCue[], time: number): string | null => {
  const active: string[] = [];
  let characters = 0;

  for (const cue of cues) {
    if (time < cue.start || time >= cue.end) continue;
    const separatorLength = active.length > 0 ? 1 : 0;
    const remainingCharacters = MAX_ACTIVE_SUBTITLE_CHARACTERS - characters - separatorLength;
    if (remainingCharacters <= 0 || active.length >= MAX_ACTIVE_SUBTITLE_CUES) break;
    const text = cue.text.slice(0, remainingCharacters);
    if (!text) continue;
    active.push(text);
    characters += text.length + separatorLength;
  }

  return active.length > 0 ? active.join("\n") : null;
};
