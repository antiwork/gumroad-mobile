import type { ErrorEvent } from "@sentry/core";

let capturedBeforeSend: ((event: ErrorEvent) => ErrorEvent | null) | undefined;

jest.mock("@sentry/react-native", () => ({
  init: jest.fn((options: { beforeSend?: (event: ErrorEvent) => ErrorEvent | null }) => {
    capturedBeforeSend = options.beforeSend;
  }),
  reactNavigationIntegration: jest.fn(() => ({ name: "ReactNavigation" })),
}));

const errorEvent = (values: { type?: string; value?: string }[]): ErrorEvent =>
  ({ exception: { values } }) as ErrorEvent;

const runBeforeSend = (event: ErrorEvent) => {
  if (!capturedBeforeSend) throw new Error("beforeSend was not registered");
  return capturedBeforeSend(event);
};

describe("sentry beforeSend", () => {
  beforeAll(() => {
    require("@/lib/sentry");
  });

  describe("drops non-actionable transient errors (gumroad-to issue 7336845703)", () => {
    const dropped: [string, ErrorEvent][] = [
      ["iOS network lost", errorEvent([{ type: "Error", value: "Unable to download a file: The network connection was lost." }])],
      ["iOS timeout", errorEvent([{ type: "Error", value: "Unable to download a file: The request timed out." }])],
      ["iOS offline", errorEvent([{ type: "Error", value: "Unable to download a file: The Internet connection appears to be offline." }])],
      [
        "Android socket timeout in chained cause",
        errorEvent([
          { type: "Error", value: "Call to function 'FileSystem.downloadFileAsync' has been rejected." },
          { type: "Error", value: "java.net.SocketTimeoutException: timeout" },
        ]),
      ],
      [
        "Android connection abort in chained cause",
        errorEvent([
          { type: "Error", value: "Call to function 'FileSystem.downloadFileAsync' has been rejected." },
          { type: "Error", value: "java.net.SocketException: Software caused connection abort" },
        ]),
      ],
      [
        "Android stream reset in chained cause",
        errorEvent([
          { type: "Error", value: "Call to function 'FileSystem.downloadFileAsync' has been rejected." },
          { type: "Error", value: "okhttp3.internal.http2.StreamResetException: stream was reset: INTERNAL_ERROR" },
        ]),
      ],
      [
        "font/icon asset download failure",
        errorEvent([
          { type: "Error", value: "Call to function 'ExpoAsset.downloadAsync' has been rejected." },
          { type: "Error", value: "Unable to download asset from url: node_modules_boxicons_core_fonts" },
        ]),
      ],
      [
        "Android FCM token registration",
        errorEvent([
          {
            type: "Error",
            value:
              "Fetching the token failed: java.util.concurrent.ExecutionException: java.io.IOException: SERVICE_NOT_AVAILABLE",
          },
        ]),
      ],
      ["notifications not allowed", errorEvent([{ type: "Error", value: "Notifications are not allowed for this application" }])],
      ["generic network failure", errorEvent([{ type: "TypeError", value: "Network request failed" }])],
      ["aborted request", errorEvent([{ type: "AbortError", value: "Aborted" }])],
      ["user interaction not allowed", errorEvent([{ type: "Error", value: "User interaction is not allowed" }])],
    ];

    it.each(dropped)("drops: %s", (_label, event) => {
      expect(runBeforeSend(event)).toBeNull();
    });
  });

  describe("keeps actionable errors", () => {
    const kept: [string, ErrorEvent][] = [
      ["download 404 (real missing file)", errorEvent([{ type: "Error", value: "Unable to download a file: response has status 404" }])],
      [
        "illegal path character (real bug, not transient)",
        errorEvent([
          { type: "Error", value: "Call to function 'FileSystem.downloadFileAsync' has been rejected." },
          { type: "Error", value: "java.lang.IllegalArgumentException: Illegal character in path at index 92" },
        ]),
      ],
      ["generic application error", errorEvent([{ type: "TypeError", value: "Cannot read property 'id' of undefined" }])],
      [
        "persistent TLS failure (actionable cert/config bug)",
        errorEvent([{ type: "Error", value: "javax.net.ssl.SSLException: Connection closed by peer" }]),
      ],
      [
        "non-abort error that merely mentions AbortError in its message",
        errorEvent([{ type: "TypeError", value: "Failed to handle AbortError fallback path" }]),
      ],
    ];

    it.each(kept)("keeps: %s", (_label, event) => {
      expect(runBeforeSend(event)).toBe(event);
    });
  });
});
