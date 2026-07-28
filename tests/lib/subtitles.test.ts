import {
  activeCueText,
  MAX_ACTIVE_SUBTITLE_CHARACTERS,
  MAX_ACTIVE_SUBTITLE_CUES,
  MAX_SUBTITLE_CUES,
  parseSubtitles,
} from "@/lib/subtitles";

describe("parseSubtitles", () => {
  it("parses SRT cues", () => {
    const srt = `1
00:00:01,000 --> 00:00:04,000
Hello there

2
00:00:05,500 --> 00:00:07,250
Second line
continues here
`;
    expect(parseSubtitles(srt)).toEqual([
      { start: 1, end: 4, text: "Hello there" },
      { start: 5.5, end: 7.25, text: "Second line\ncontinues here" },
    ]);
  });

  it("parses WebVTT cues including headers, hour-less timestamps, and cue settings", () => {
    const vtt = `WEBVTT

NOTE a comment block

00:01.000 --> 00:04.000 align:center position:50%
First cue

intro-cue
00:00:05.000 --> 00:00:06.000
<v Speaker>Tagged <b>text</b> with {product}</v>
`;
    expect(parseSubtitles(vtt)).toEqual([
      { start: 1, end: 4, text: "First cue" },
      { start: 5, end: 6, text: "Tagged text with {product}" },
    ]);
  });

  it("decodes WebVTT entities after removing caption markup", () => {
    const vtt = `WEBVTT

00:01.000 --> 00:04.000
<v Speaker>Ol&aacute; &amp; Ria&lt;3&nbsp;&#39;today&#39;</v>
`;
    expect(parseSubtitles(vtt)).toEqual([{ start: 1, end: 4, text: "Olá & Ria<3\u00A0'today'" }]);
  });

  it("preserves literal and unknown angle-bracket text", () => {
    const srt = `1
00:00:01,000 --> 00:00:04,000
if (x < limit && y > 0), return Array<T>
`;
    expect(parseSubtitles(srt)).toEqual([{ start: 1, end: 4, text: "if (x < limit && y > 0), return Array<T>" }]);
  });

  it("parses SBV cues", () => {
    const sbv = `0:00:01.000,0:00:03.000
SBV cue text
`;
    expect(parseSubtitles(sbv)).toEqual([{ start: 1, end: 3, text: "SBV cue text" }]);
  });

  it("separates cues when blank lines contain spaces or tabs", () => {
    const blankLine = " \t ";
    const srt = `1
00:00:01,000 --> 00:00:02,000
First cue
${blankLine}
2
00:00:03,000 --> 00:00:04,000
Second cue
`;
    expect(parseSubtitles(srt)).toEqual([
      { start: 1, end: 2, text: "First cue" },
      { start: 3, end: 4, text: "Second cue" },
    ]);
  });

  it("parses frame-based MicroDVD SUB cues", () => {
    const sub = `{1}{1}25.000
{25}{50}{y:i}First {product}|Second line
`;
    expect(parseSubtitles(sub)).toEqual([{ start: 1, end: 2, text: "First {product}\nSecond line" }]);
  });

  it("does not treat MicroDVD-shaped SRT cue text as frame timings", () => {
    const srt = `1
00:00:01,000 --> 00:00:04,000
{25}{50}example
`;
    expect(parseSubtitles(srt)).toEqual([{ start: 1, end: 4, text: "{25}{50}example" }]);
  });

  it("parses SubViewer line breaks", () => {
    const sub = `0:00:01.000,0:00:03.000
First line[br]Second line
`;
    expect(parseSubtitles(sub)).toEqual([{ start: 1, end: 3, text: "First line\nSecond line" }]);
  });

  it("handles BOM and CRLF line endings", () => {
    const srt = "\uFEFF1\r\n00:00:01,000 --> 00:00:02,000\r\nWindows file\r\n";
    expect(parseSubtitles(srt)).toEqual([{ start: 1, end: 2, text: "Windows file" }]);
  });

  it("skips malformed cues without dropping the rest of the file", () => {
    const srt = `1
not a timestamp
Broken cue

2
00:00:03,000 --> 00:00:02,000
End before start

3
00:00:05,000 --> 00:00:06,000

4
00:00:08,000 --> 00:00:09,000
Survivor
`;
    expect(parseSubtitles(srt)).toEqual([{ start: 8, end: 9, text: "Survivor" }]);
  });

  it("returns an empty array for empty or garbage input", () => {
    expect(parseSubtitles("")).toEqual([]);
    expect(parseSubtitles("just some prose with no timestamps")).toEqual([]);
  });

  it("sorts cues by start time", () => {
    const srt = `1
00:00:10,000 --> 00:00:12,000
Later

2
00:00:01,000 --> 00:00:02,000
Earlier
`;
    expect(parseSubtitles(srt).map((cue) => cue.text)).toEqual(["Earlier", "Later"]);
  });

  it("rejects tracks with too many cues", () => {
    const srt = Array.from(
      { length: MAX_SUBTITLE_CUES + 1 },
      (_, index) => `${index + 1}\n00:00:01,000 --> 00:00:02,000\nCue ${index + 1}`,
    ).join("\n\n");

    expect(() => parseSubtitles(srt)).toThrow("cue limit");
  });
});

describe("activeCueText", () => {
  const cues = [
    { start: 1, end: 4, text: "First" },
    { start: 3, end: 6, text: "Overlap" },
    { start: 10, end: 12, text: "Last" },
  ];

  it("returns the cue covering the current time", () => {
    expect(activeCueText(cues, 2)).toBe("First");
    expect(activeCueText(cues, 11)).toBe("Last");
  });

  it("joins overlapping cues with a newline", () => {
    expect(activeCueText(cues, 3.5)).toBe("First\nOverlap");
  });

  it("treats cue end times as exclusive", () => {
    expect(
      activeCueText(
        [
          { start: 1, end: 2, text: "First" },
          { start: 2, end: 3, text: "Second" },
        ],
        2,
      ),
    ).toBe("Second");
  });

  it("returns null when no cue is active", () => {
    expect(activeCueText(cues, 8)).toBeNull();
    expect(activeCueText([], 2)).toBeNull();
  });

  it("bounds simultaneous cues and rendered text", () => {
    const overlappingCues = Array.from({ length: MAX_ACTIVE_SUBTITLE_CUES + 2 }, (_, index) => ({
      start: 0,
      end: 10,
      text: `Cue ${index}`,
    }));
    expect(activeCueText(overlappingCues, 1)?.split("\n")).toHaveLength(MAX_ACTIVE_SUBTITLE_CUES);

    const longText = "x".repeat(MAX_ACTIVE_SUBTITLE_CHARACTERS + 1_000);
    expect(activeCueText([{ start: 0, end: 10, text: longText }], 1)).toHaveLength(MAX_ACTIVE_SUBTITLE_CHARACTERS);
  });
});
