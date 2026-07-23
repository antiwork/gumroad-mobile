const mockIsAvailableAsync = jest.fn();
const mockShareAsync = jest.fn();

jest.mock("expo-sharing", () => ({
  isAvailableAsync: (...args: unknown[]) => mockIsAvailableAsync(...args),
  shareAsync: (...args: unknown[]) => mockShareAsync(...args),
}));

import { shareFile } from "@/lib/share";

type Deferred = { promise: Promise<void>; resolve: () => void; reject: (error: Error) => void };

const createDeferred = (): Deferred => {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe("shareFile", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAvailableAsync.mockResolvedValue(true);
    mockShareAsync.mockResolvedValue(undefined);
  });

  it("shares the file when sharing is available", async () => {
    await shareFile("file:///cache/test.pdf");

    expect(mockShareAsync).toHaveBeenCalledWith("file:///cache/test.pdf");
  });

  it("passes options through to shareAsync", async () => {
    await shareFile("file:///cache/sales.csv", { mimeType: "text/csv" });

    expect(mockShareAsync).toHaveBeenCalledWith("file:///cache/sales.csv", { mimeType: "text/csv" });
  });

  it("throws when sharing is not available", async () => {
    mockIsAvailableAsync.mockResolvedValue(false);

    await expect(shareFile("file:///cache/test.pdf")).rejects.toThrow("Sharing is not available on this device");
    expect(mockShareAsync).not.toHaveBeenCalled();
  });

  it("ignores a second share request while one is in flight", async () => {
    const deferred = createDeferred();
    mockShareAsync.mockReturnValue(deferred.promise);

    const first = shareFile("file:///cache/first.pdf");
    await Promise.resolve();
    const second = shareFile("file:///cache/second.pdf");

    await second;
    expect(mockShareAsync).toHaveBeenCalledTimes(1);

    deferred.resolve();
    await first;
  });

  it("allows sharing again after the previous share settles", async () => {
    await shareFile("file:///cache/first.pdf");
    await shareFile("file:///cache/second.pdf");

    expect(mockShareAsync).toHaveBeenCalledTimes(2);
  });

  it("allows sharing again after the previous share fails", async () => {
    mockShareAsync.mockRejectedValueOnce(new Error("User did not share"));

    await expect(shareFile("file:///cache/first.pdf")).rejects.toThrow("User did not share");
    await shareFile("file:///cache/second.pdf");

    expect(mockShareAsync).toHaveBeenCalledTimes(2);
  });

  it("swallows the native concurrent-share rejection", async () => {
    mockShareAsync.mockRejectedValueOnce(
      new Error(
        "Call to function 'ExpoSharing.shareAsync' has been rejected.\n→ Caused by: Another share request is being processed now.",
      ),
    );

    await expect(shareFile("file:///cache/test.pdf")).resolves.toBeUndefined();
  });

  it("rethrows other share errors", async () => {
    mockShareAsync.mockRejectedValueOnce(new Error("Something else broke"));

    await expect(shareFile("file:///cache/test.pdf")).rejects.toThrow("Something else broke");
  });
});
