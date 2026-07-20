jest.mock("expo-file-system", () => {
  const Paths = { cache: "/cache" };
  class Directory {
    uri: string;
    exists = false;
    constructor(parent: string | { uri: string }, name: string) {
      const base = typeof parent === "string" ? parent : parent.uri;
      this.uri = `${base}/${name}`;
    }
    create() {
      this.exists = true;
    }
  }
  class File {
    name: string;
    uri: string;
    constructor(parent: string | { uri: string }, name: string) {
      const base = typeof parent === "string" ? parent : parent.uri;
      this.name = name;
      this.uri = `${base}/${name}`;
    }
  }
  return { Directory, File, Paths };
});

import { File } from "expo-file-system";
import { cacheFileDestination, downloadFileWithRetry } from "@/lib/file-utils";

describe("cacheFileDestination", () => {
  it("neutralizes URL-significant characters that break native file URI parsing", () => {
    const destination = cacheFileDestination("file-id", "HOW TO BECOME AN ELITE PLAYER 99%#.pdf");

    expect(destination.name).toBe("HOW TO BECOME AN ELITE PLAYER 99__.pdf");
    expect(destination.name).not.toMatch(/[%#]/);
  });

  it("neutralizes characters that are illegal in file names", () => {
    const destination = cacheFileDestination("file-id", 'a/b\\c:d*e?f"g<h>i|j.pdf');

    expect(destination.name).not.toMatch(/[/\\:*?"<>|]/);
  });

  it("neutralizes square brackets and other URI delimiters that crash native path parsing", () => {
    const destination = cacheFileDestination("file-id", "301 [NSFW] Rider [2023].png");

    expect(destination.name).toBe("301 _NSFW_ Rider _2023_.png");
    expect(destination.name).not.toMatch(/[[\]{}^`]/);
  });

  it("preserves spaces, which are valid in file URIs", () => {
    const destination = cacheFileDestination("file-id", "my great file.pdf");

    expect(destination.name).toBe("my great file.pdf");
  });

  it("clamps overly long names while preserving the extension", () => {
    const destination = cacheFileDestination("file-id", `${"a".repeat(250)}.pdf`);

    expect(destination.name).toHaveLength(200);
    expect(destination.name.endsWith(".pdf")).toBe(true);
  });
});

describe("downloadFileWithRetry", () => {
  const destination = new File("/cache/file-id", "audio.mp3");
  let downloadMock: jest.Mock;

  beforeEach(() => {
    downloadMock = jest.fn();
    (File as unknown as { downloadFileAsync: jest.Mock }).downloadFileAsync = downloadMock;
  });

  it("returns the file on first success without retrying", async () => {
    downloadMock.mockResolvedValue(destination);

    await expect(downloadFileWithRetry("https://example.com/f", destination)).resolves.toBe(destination);
    expect(downloadMock).toHaveBeenCalledTimes(1);
  });

  it("retries once after a transient network failure", async () => {
    downloadMock.mockRejectedValueOnce(new Error("SocketTimeoutException: timeout")).mockResolvedValue(destination);

    await expect(downloadFileWithRetry("https://example.com/f", destination)).resolves.toBe(destination);
    expect(downloadMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry HTTP status failures, which are deterministic", async () => {
    downloadMock.mockRejectedValue(new Error("response has status: 404"));

    await expect(downloadFileWithRetry("https://example.com/f", destination)).rejects.toThrow(
      "response has status: 404",
    );
    expect(downloadMock).toHaveBeenCalledTimes(1);
  });

  it("surfaces the second failure when the retry also fails", async () => {
    downloadMock
      .mockRejectedValueOnce(new Error("Network request failed"))
      .mockRejectedValueOnce(new Error("Network request failed again"));

    await expect(downloadFileWithRetry("https://example.com/f", destination)).rejects.toThrow(
      "Network request failed again",
    );
    expect(downloadMock).toHaveBeenCalledTimes(2);
  });
});
