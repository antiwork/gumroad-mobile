import { activeCueText, parseSubtitles } from "@/lib/subtitles";

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
<v Speaker>Tagged {b}text{/b}</v>
`;
    expect(parseSubtitles(vtt)).toEqual([
      { start: 1, end: 4, text: "First cue" },
      { start: 5, end: 6, text: "Tagged text" },
    ]);
  });

  it("parses SBV cues", () => {
    const sbv = `0:00:01.000,0:00:03.000
SBV cue text
`;
    expect(parseSubtitles(sbv)).toEqual([{ start: 1, end: 3, text: "SBV cue text" }]);
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

  it("returns null when no cue is active", () => {
    expect(activeCueText(cues, 8)).toBeNull();
    expect(activeCueText([], 2)).toBeNull();
  });
});
