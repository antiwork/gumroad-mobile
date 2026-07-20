import type { ErrorEvent } from "@sentry/core";

let capturedBeforeSend: ((event: ErrorEvent) => ErrorEvent | null) | undefined;
let capturedInitOptions: Record<string, unknown> | undefined;

jest.mock("@sentry/react-native", () => ({
  init: jest.fn((options: { beforeSend?: (event: ErrorEvent) => ErrorEvent | null }) => {
    capturedBeforeSend = options.beforeSend;
    capturedInitOptions = options as Record<string, unknown>;
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

  describe("iOS app-hang detection (gumroad-to issue 7384299696)", () => {
    it("enables v2 app-hang tracking so hangs interrupted by app suspension are not falsely reported", () => {
      expect(capturedInitOptions?.enableAppHangTrackingV2).toBe(true);
    });

    it("does not report non-fully-blocking hangs (main thread still processing some events)", () => {
      expect(capturedInitOptions?.enableReportNonFullyBlockingAppHangs).toBe(false);
    });
  });

  describe("drops non-actionable transient errors (gumroad-to issue 7336845703)", () => {
    const dropped: [string, ErrorEvent][] = [
      [
        "iOS network lost",
        errorEvent([{ type: "Error", value: "Unable to download a file: The network connection was lost." }]),
      ],
      [
        "stale blob after app suspension (gumroad-to issue 7376092087)",
        errorEvent([{ type: "Error", value: "Unable to resolve data for blob: 8e39a7c2-1f4b-4b6e-9a70-000000000000" }]),
      ],
      [
        "gateway timeout from the API (gumroad-to issue 7376627649)",
        errorEvent([{ type: "Error", value: "Request failed: 504 <!DOCTYPE html..." }]),
      ],
      ["bad gateway from the API", errorEvent([{ type: "Error", value: "Request failed: 502" }])],
      ["service unavailable from the API", errorEvent([{ type: "Error", value: "Request failed: 503" }])],
      [
        "whatwg-fetch timeout variant (gumroad-to issue 7375667799)",
        errorEvent([{ type: "TypeError", value: "Network request timed out" }]),
      ],
      [
        "Android stale/purged blob variant (gumroad-to issue 7383427894)",
        errorEvent([{ type: "Error", value: "The specified blob is invalid" }]),
      ],
      [
        "stale blob with only native (non-app) frames",
        {
          exception: {
            values: [
              {
                type: "Error",
                value: "Unable to resolve data for blob: 8e39a7c2-1f4b-4b6e-9a70-000000000000",
                stacktrace: { frames: [{ function: "readAsText", in_app: false }] },
              },
            ],
          },
        } as ErrorEvent,
      ],
      ["iOS timeout", errorEvent([{ type: "Error", value: "Unable to download a file: The request timed out." }])],
      [
        "iOS offline",
        errorEvent([
          { type: "Error", value: "Unable to download a file: The Internet connection appears to be offline." },
        ]),
      ],
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
      [
        "Android FCM token registration via Firebase Installations auth (FIS_AUTH_ERROR)",
        errorEvent([
          {
            type: "Error",
            value:
              "Fetching the token failed: java.util.concurrent.ExecutionException: java.io.IOException: FIS_AUTH_ERROR",
          },
        ]),
      ],
      [
        "notifications not allowed",
        errorEvent([{ type: "Error", value: "Notifications are not allowed for this application" }]),
      ],
      ["generic network failure", errorEvent([{ type: "TypeError", value: "Network request failed" }])],
      ["aborted request", errorEvent([{ type: "AbortError", value: "Aborted" }])],
      ["user interaction not allowed", errorEvent([{ type: "Error", value: "User interaction is not allowed" }])],
      ["expired session (UnauthorizedError)", errorEvent([{ type: "UnauthorizedError", value: "Unauthorized" }])],
    ];

    it.each(dropped)("drops: %s", (_label, event) => {
      expect(runBeforeSend(event)).toBeNull();
    });
  });

  describe("keeps actionable errors", () => {
    const kept: [string, ErrorEvent][] = [
      [
        "download 404 (real missing file)",
        errorEvent([{ type: "Error", value: "Unable to download a file: response has status 404" }]),
      ],
      [
        "plain 500 from the API (possible malformed request built by the app)",
        errorEvent([{ type: "Error", value: "Request failed: 500" }]),
      ],
      [
        "illegal path character (real bug, not transient)",
        errorEvent([
          { type: "Error", value: "Call to function 'FileSystem.downloadFileAsync' has been rejected." },
          { type: "Error", value: "java.lang.IllegalArgumentException: Illegal character in path at index 92" },
        ]),
      ],
      [
        "generic application error",
        errorEvent([{ type: "TypeError", value: "Cannot read property 'id' of undefined" }]),
      ],
      [
        "persistent TLS failure (actionable cert/config bug)",
        errorEvent([{ type: "Error", value: "javax.net.ssl.SSLException: Connection closed by peer" }]),
      ],
      [
        "non-abort error that merely mentions AbortError in its message",
        errorEvent([{ type: "TypeError", value: "Failed to handle AbortError fallback path" }]),
      ],
      [
        "actionable FCM misconfiguration (token failure, but not a transient cause)",
        errorEvent([{ type: "Error", value: "Fetching the token failed: java.io.IOException: AUTHENTICATION_FAILED" }]),
      ],
      [
        "non-download API failure with a native network cause (no download context)",
        errorEvent([
          { type: "Error", value: "Token refresh request failed" },
          { type: "Error", value: "java.net.ConnectException: Failed to connect to api.gumroad.com" },
        ]),
      ],
      [
        "real primary error with an UnauthorizedError later in the chain",
        errorEvent([
          { type: "TypeError", value: "Cannot read property 'id' of undefined" },
          { type: "UnauthorizedError", value: "Unauthorized" },
        ]),
      ],
      [
        "real primary error with an AbortError later in the chain",
        errorEvent([
          { type: "TypeError", value: "Cannot read property 'x' of undefined" },
          { type: "AbortError", value: "Aborted" },
        ]),
      ],
      [
        "stale blob read WITH app frames (call site outside lib/request.ts must still report)",
        {
          exception: {
            values: [
              {
                type: "Error",
                value: "Unable to resolve data for blob: 8e39a7c2-1f4b-4b6e-9a70-000000000000",
                stacktrace: {
                  frames: [
                    { function: "readAsText", in_app: false },
                    { function: "loadReceipt", in_app: true },
                  ],
                },
              },
            ],
          },
        } as ErrorEvent,
      ],
    ];

    it.each(kept)("keeps: %s", (_label, event) => {
      expect(runBeforeSend(event)).toBe(event);
    });
  });
});
