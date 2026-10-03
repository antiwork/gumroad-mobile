import * as Sentry from "@sentry/react-native";

import { classifyLibraryLoadError, LIBRARY_LOAD_ENDPOINT, reportLibraryLoadFailure } from "@/lib/library-load-report";

const captureEvent = Sentry.captureEvent as jest.Mock;

const abortError = () => Object.assign(new Error("Aborted"), { name: "AbortError" });

class HttpError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "ServerError";
    this.statusCode = statusCode;
  }
}

describe("classifyLibraryLoadError", () => {
  it("reads an abort (the 30s client timeout) as `abort`", () => {
    expect(classifyLibraryLoadError(abortError())).toBe("abort");
  });

  it("reads a status-bearing error as http_<status>", () => {
    expect(classifyLibraryLoadError(new HttpError(503, "Request failed: 503"))).toBe("http_503");
    expect(classifyLibraryLoadError(new HttpError(500, "Request failed: 500"))).toBe("http_500");
  });

  it("reads React Native's offline fetch failure as `network`", () => {
    expect(classifyLibraryLoadError(new Error("Network request failed"))).toBe("network");
  });

  it("falls back to `other` for anything unrecognised", () => {
    expect(classifyLibraryLoadError(new Error("boom"))).toBe("other");
    expect(classifyLibraryLoadError("not an error")).toBe("other");
    expect(classifyLibraryLoadError(undefined)).toBe("other");
  });
});

describe("reportLibraryLoadFailure", () => {
  beforeEach(() => jest.clearAllMocks());

  it("reports one sanitized, fingerprinted event per reason", () => {
    reportLibraryLoadFailure(abortError(), 30_012, 2);

    expect(captureEvent).toHaveBeenCalledTimes(1);
    const event = captureEvent.mock.calls[0][0];
    expect(event.message).toBe("library_load_failed");
    expect(event.fingerprint).toEqual(["library_load_failed", "abort"]);
    expect(event.tags).toEqual({
      library_load_failed: "true",
      reason: "abort",
      endpoint: LIBRARY_LOAD_ENDPOINT,
    });
    expect(event.extra).toEqual({ elapsed_ms: 30_012, failure_count: 2 });
  });

  it("carries no payload, query string or token", () => {
    reportLibraryLoadFailure(new HttpError(404, "Request failed: 404 Not found"), 120, 1);

    const serialized = JSON.stringify(captureEvent.mock.calls[0][0]);
    expect(serialized).not.toContain("Bearer");
    expect(serialized).not.toContain("mobile_token");
    expect(serialized).not.toContain("?");
    expect(serialized).not.toContain("Not found");
  });
});
