import { fetch as streamingFetch } from "expo/fetch";

export const MAX_SUBTITLE_BYTES = 2 * 1024 * 1024;

export const fetchSubtitleText = async (url: string): Promise<string> => {
  const controller = new AbortController();
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  try {
    const response = await streamingFetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Subtitle fetch failed with status ${response.status}`);

    const contentLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_SUBTITLE_BYTES) {
      throw new Error(`Subtitle file exceeds the ${MAX_SUBTITLE_BYTES}-byte limit`);
    }

    if (!response.body) throw new Error("Subtitle response has no readable body");

    reader = response.body.getReader();
    const decoder = new TextDecoder();
    const chunks: string[] = [];
    let receivedBytes = 0;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      receivedBytes += value.byteLength;
      if (receivedBytes > MAX_SUBTITLE_BYTES) {
        throw new Error(`Subtitle file exceeds the ${MAX_SUBTITLE_BYTES}-byte limit`);
      }
      chunks.push(decoder.decode(value, { stream: true }));
    }
    chunks.push(decoder.decode());
    return chunks.join("");
  } finally {
    controller.abort();
    reader?.cancel().catch(() => {});
  }
};
