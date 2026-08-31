import { isTransientPlaybackError } from "@/lib/transient-playback-error";

describe("isTransientPlaybackError", () => {
  it.each([
    "The network connection was lost.",
    "HttpDataSourceException: Unable to connect",
    "SocketTimeoutException",
    "Source error",
    "Request failed: 502",
    "behind live window",
    "The Internet connection appears to be offline.",
  ])("treats %s as recoverable", (message) => {
    expect(isTransientPlaybackError(message)).toBe(true);
  });

  it.each([
    "AVPlayer cannot decode the file",
    "Playback failed",
    "Renderer error",
    "404 Not Found",
    "",
    undefined,
    null,
  ])("does not treat %s as recoverable", (message) => {
    expect(isTransientPlaybackError(message)).toBe(false);
  });
});
