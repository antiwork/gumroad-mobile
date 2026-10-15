import { orderAudioFilesChronologically } from "@/lib/audio-playlist";

describe("orderAudioFilesChronologically", () => {
  it("orders files oldest first, whatever order the API sent them in", () => {
    const files = [
      { id: "c", created_at: "2026-09-28T15:33:52.000Z" },
      { id: "a", created_at: "2019-08-08T01:01:52.000Z" },
      { id: "b", created_at: "2026-09-17T20:33:35.000Z" },
    ];

    expect(orderAudioFilesChronologically(files).map((file) => file.id)).toEqual(["a", "b", "c"]);
  });

  it("treats a file with no upload time as the oldest, keeping their relative order", () => {
    const files = [
      { id: "a", created_at: "2026-01-01T00:00:00.000Z" },
      { id: "b", created_at: "2026-01-01T00:00:00.000Z" },
      { id: "c" },
      { id: "d" },
    ];

    expect(orderAudioFilesChronologically(files).map((file) => file.id)).toEqual(["c", "d", "a", "b"]);
  });

  it("leaves the caller's array untouched", () => {
    const files = [{ id: "b", created_at: "2026-02-01T00:00:00.000Z" }, { id: "a", created_at: "2026-01-01T00:00:00.000Z" }];

    orderAudioFilesChronologically(files);

    expect(files.map((file) => file.id)).toEqual(["b", "a"]);
  });
});
