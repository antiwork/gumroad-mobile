jest.mock("@sentry/react-native", () => ({
  addBreadcrumb: jest.fn(),
  captureException: jest.fn(),
}));

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
import * as Sentry from "@sentry/react-native";
import { cacheFileDestination, downloadFileWithRetry, FileUnavailableError } from "@/lib/file-utils";

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
    jest.clearAllMocks();
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

  it("does not retry non-404 HTTP status failures, which are deterministic", async () => {
    downloadMock.mockRejectedValue(new Error("response has status: 403"));

    await expect(downloadFileWithRetry("https://example.com/f", destination)).rejects.toThrow(
      "response has status: 403",
    );
    expect(downloadMock).toHaveBeenCalledTimes(1);
  });

  it("refreshes the URL and retries once on a 404", async () => {
    downloadMock.mockRejectedValueOnce(new Error("response has status: 404")).mockResolvedValue(destination);
    const refreshUrl = jest.fn().mockResolvedValue("https://example.com/fresh");

    await expect(downloadFileWithRetry("https://example.com/stale", destination, { refreshUrl })).resolves.toBe(
      destination,
    );
    expect(refreshUrl).toHaveBeenCalledTimes(1);
    expect(downloadMock).toHaveBeenNthCalledWith(1, "https://example.com/stale", destination, { idempotent: true });
    expect(downloadMock).toHaveBeenNthCalledWith(2, "https://example.com/fresh", destination, { idempotent: true });
  });

  it("throws FileUnavailableError with a breadcrumb, not a raw 404, when the refreshed retry also 404s", async () => {
    downloadMock.mockRejectedValue(new Error("response has status: 404"));
    const refreshUrl = jest.fn().mockResolvedValue("https://example.com/fresh");

    await expect(downloadFileWithRetry("https://example.com/stale", destination, { refreshUrl })).rejects.toThrow(
      FileUnavailableError,
    );
    expect(downloadMock).toHaveBeenCalledTimes(2);
    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(expect.objectContaining({ category: "download" }));
  });

  it("retries the original URL once on a 404 when no refreshUrl is provided", async () => {
    downloadMock.mockRejectedValueOnce(new Error("response has status: 404")).mockResolvedValue(destination);

    await expect(downloadFileWithRetry("https://example.com/f", destination)).resolves.toBe(destination);
    expect(downloadMock).toHaveBeenCalledTimes(2);
    expect(downloadMock).toHaveBeenNthCalledWith(2, "https://example.com/f", destination, { idempotent: true });
  });

  it("falls back to retrying the original URL when refreshing the URL fails", async () => {
    downloadMock.mockRejectedValueOnce(new Error("response has status: 404")).mockResolvedValue(destination);
    const refreshUrl = jest.fn().mockRejectedValue(new Error("Network request failed"));

    await expect(downloadFileWithRetry("https://example.com/f", destination, { refreshUrl })).resolves.toBe(
      destination,
    );
    expect(downloadMock).toHaveBeenNthCalledWith(2, "https://example.com/f", destination, { idempotent: true });
  });

  it("surfaces a non-404 failure from the post-404 retry unchanged", async () => {
    downloadMock
      .mockRejectedValueOnce(new Error("response has status: 404"))
      .mockRejectedValueOnce(new Error("Network request failed"));
    const refreshUrl = jest.fn().mockResolvedValue("https://example.com/fresh");

    await expect(downloadFileWithRetry("https://example.com/f", destination, { refreshUrl })).rejects.toThrow(
      "Network request failed",
    );
    expect(Sentry.addBreadcrumb).not.toHaveBeenCalled();
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
