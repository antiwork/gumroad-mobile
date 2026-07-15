// Regression test for Sentry issue GUMROAD-MOBILE-ZN:
// "TypeError: The stream is not in a state that permits close" raised from
// expo/fetch's FetchResponse when native delivers `didComplete` (or
// `didFailWithError`) after the JS consumer has already canceled the body
// stream. Our agent streaming client (lib/agent.ts) always calls
// `reader.cancel()` when it stops reading, so a late native completion event
// used to call `controller.close()` on an already-closed stream controller.
//
// The fix (patches/expo+55.0.9.patch, backport of expo/expo#44909) makes the
// listeners check the closed flag before touching the controller.

import { FetchResponse } from "expo/src/winter/fetch/FetchResponse";

jest.mock("expo/src/winter/fetch/ExpoFetchModule", () => {
  class StubNativeResponse {
    private listeners = new Map<string, Set<(...args: unknown[]) => void>>();

    get status() {
      return 200;
    }
    get statusText() {
      return "OK";
    }
    get url() {
      return "https://example.com/stream";
    }
    get redirected() {
      return false;
    }
    get _rawHeaders(): [string, string][] {
      return [["content-type", "text/event-stream"]];
    }
    get bodyUsed() {
      return false;
    }

    addListener(event: string, listener: (...args: unknown[]) => void) {
      if (!this.listeners.has(event)) this.listeners.set(event, new Set());
      this.listeners.get(event)?.add(listener);
    }
    removeListener(event: string, listener: (...args: unknown[]) => void) {
      this.listeners.get(event)?.delete(listener);
    }
    removeAllListeners(event: string) {
      this.listeners.delete(event);
    }
    emit(event: string, ...args: unknown[]) {
      for (const listener of this.listeners.get(event) ?? []) listener(...args);
    }

    startStreaming(): Promise<Uint8Array | null> {
      return Promise.resolve(null);
    }
    cancelStreaming(_reason: string) {}
  }

  return { ExpoFetchModule: { NativeResponse: StubNativeResponse } };
});

const makeResponse = () =>
  new FetchResponse(() => {}) as FetchResponse & { emit: (event: string, ...args: unknown[]) => void };

describe("expo/fetch FetchResponse late native events after cancel", () => {
  it("does not throw when native emits didComplete after the stream was canceled", async () => {
    const response = makeResponse();
    const reader = response.body!.getReader();

    await reader.cancel("consumer canceled");
    expect(() => response.emit("didComplete")).not.toThrow();
  });

  it("does not throw when native emits didFailWithError after the stream was canceled", async () => {
    const response = makeResponse();
    const reader = response.body!.getReader();

    await reader.cancel("consumer canceled");
    expect(() => response.emit("didFailWithError", "late error")).not.toThrow();
  });

  it("does not throw when native emits didComplete twice", async () => {
    const response = makeResponse();
    const reader = response.body!.getReader();
    const readPromise = reader.read();

    response.emit("didComplete");
    expect(() => response.emit("didComplete")).not.toThrow();

    await readPromise;
  });
});
