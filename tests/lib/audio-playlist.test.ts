import { orderAudioFilesForPlayback } from "@/lib/audio-playlist";

describe("orderAudioFilesForPlayback", () => {
  it("orders a newest-first catalog by upload time so playback runs forward", () => {
    const files = [
      { id: "d", created_at: "2026-09-28T15:33:52.000Z" },
      { id: "c", created_at: "2026-09-17T20:33:35.000Z" },
      { id: "b", created_at: "2026-01-01T00:00:00.000Z" },
      { id: "a", created_at: "2019-08-08T01:01:52.000Z" },
    ];

    expect(orderAudioFilesForPlayback(files).map((file) => file.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("keeps the seller's order when the layout already runs oldest first", () => {
    const files = [
      { id: "a", created_at: "2019-08-08T01:01:52.000Z" },
      { id: "b", created_at: "2026-01-01T00:00:00.000Z" },
      { id: "c", created_at: "2026-09-28T15:33:52.000Z" },
    ];

    expect(orderAudioFilesForPlayback(files)).toBe(files);
  });

  it("keeps a replaced track that was uploaded later in the seller's order", () => {
    const files = [
      { id: "a", created_at: "2026-09-28T15:33:52.000Z" },
      { id: "b", created_at: "2026-01-01T00:00:00.000Z" },
      { id: "c", created_at: "2026-02-01T00:00:00.000Z" },
      { id: "d", created_at: "2026-03-01T00:00:00.000Z" },
    ];

    expect(orderAudioFilesForPlayback(files)).toBe(files);
  });

  it("leaves a single file and an empty list alone", () => {
    const single = [{ id: "a", created_at: "2026-01-01T00:00:00.000Z" }];

    expect(orderAudioFilesForPlayback(single)).toBe(single);
    expect(orderAudioFilesForPlayback([])).toEqual([]);
  });

  it("treats a file with no upload time as the oldest", () => {
    const files = [
      { id: "c", created_at: "2026-03-01T00:00:00.000Z" },
      { id: "b", created_at: "2026-01-01T00:00:00.000Z" },
      { id: "a" },
    ];

    expect(orderAudioFilesForPlayback(files).map((file) => file.id)).toEqual(["a", "b", "c"]);
  });

  it("leaves the caller's array untouched", () => {
    const files = [
      { id: "c", created_at: "2026-03-01T00:00:00.000Z" },
      { id: "b", created_at: "2026-02-01T00:00:00.000Z" },
      { id: "a", created_at: "2026-01-01T00:00:00.000Z" },
    ];

    orderAudioFilesForPlayback(files);

    expect(files.map((file) => file.id)).toEqual(["c", "b", "a"]);
  });
});
