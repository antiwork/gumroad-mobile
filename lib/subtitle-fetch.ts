import { fetch as streamingFetch } from "expo/fetch";

export const MAX_SUBTITLE_BYTES = 2 * 1024 * 1024;
export const SUBTITLE_FETCH_TIMEOUT_MS = 30_000;

type SubtitleFetchOptions = {
  signal?: AbortSignal;
  timeoutMs?: number;
};

const abortError = (timedOut: boolean) => {
  const error = new Error(timedOut ? "Subtitle request timed out" : "Subtitle request aborted");
  error.name = "AbortError";
  return error;
};

const decodeUtf16 = (bytes: Uint8Array, littleEndian: boolean): string => {
  const parts: string[] = [];
  const codeUnits: number[] = [];
  for (let index = 2; index + 1 < bytes.byteLength; index += 2) {
    codeUnits.push(littleEndian ? bytes[index] | (bytes[index + 1] << 8) : (bytes[index] << 8) | bytes[index + 1]);
    if (codeUnits.length === 8_192) {
      parts.push(String.fromCharCode(...codeUnits));
      codeUnits.length = 0;
    }
  }
  if (codeUnits.length > 0) parts.push(String.fromCharCode(...codeUnits));
  if ((bytes.byteLength - 2) % 2 !== 0) parts.push("\uFFFD");
  return parts.join("");
};

const decodeSubtitleBytes = (chunks: Uint8Array[], byteLength: number): string => {
  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return decodeUtf16(bytes, true);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return decodeUtf16(bytes, false);
  return new TextDecoder().decode(bytes);
};

export const fetchSubtitleText = async (
  url: string,
  { signal, timeoutMs = SUBTITLE_FETCH_TIMEOUT_MS }: SubtitleFetchOptions = {},
): Promise<string> => {
  const controller = new AbortController();
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  let timedOut = false;

  const forwardAbort = () => controller.abort();
  if (signal?.aborted) {
    controller.abort();
  } else {
    signal?.addEventListener("abort", forwardAbort, { once: true });
  }

  let rejectOnAbort: (() => void) | null = null;
  const aborted = new Promise<never>((_, reject) => {
    rejectOnAbort = () => reject(abortError(timedOut));
    if (controller.signal.aborted) {
      rejectOnAbort();
    } else {
      controller.signal.addEventListener("abort", rejectOnAbort, { once: true });
    }
  });
  const abortable = <T>(promise: Promise<T>): Promise<T> => Promise.race([promise, aborted]);
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await abortable(streamingFetch(url, { signal: controller.signal }));
    if (!response.ok) throw new Error(`Subtitle fetch failed with status ${response.status}`);

    const contentLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_SUBTITLE_BYTES) {
      throw new Error(`Subtitle file exceeds the ${MAX_SUBTITLE_BYTES}-byte limit`);
    }

    if (!response.body) throw new Error("Subtitle response has no readable body");

    reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let receivedBytes = 0;
    for (;;) {
      const { value, done } = await abortable(reader.read());
      if (done) break;
      receivedBytes += value.byteLength;
      if (receivedBytes > MAX_SUBTITLE_BYTES) {
        throw new Error(`Subtitle file exceeds the ${MAX_SUBTITLE_BYTES}-byte limit`);
      }
      chunks.push(value);
    }
    return decodeSubtitleBytes(chunks, receivedBytes);
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", forwardAbort);
    if (rejectOnAbort) controller.signal.removeEventListener("abort", rejectOnAbort);
    controller.abort();
    reader?.cancel().catch(() => {});
  }
};
