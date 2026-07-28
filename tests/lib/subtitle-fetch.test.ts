const mockStreamingFetch = jest.fn();

jest.mock("expo/fetch", () => ({
  fetch: (...args: unknown[]) => mockStreamingFetch(...args),
}));

import { fetchSubtitleText, MAX_SUBTITLE_BYTES } from "@/lib/subtitle-fetch";

const makeResponse = ({
  chunks = [],
  contentLength,
  ok = true,
  status = 200,
}: {
  chunks?: Uint8Array[];
  contentLength?: number;
  ok?: boolean;
  status?: number;
}) => {
  let index = 0;
  const cancel = jest.fn().mockResolvedValue(undefined);
  const read = jest.fn(async () =>
    index < chunks.length ? { value: chunks[index++], done: false } : { value: undefined, done: true },
  );

  return {
    response: {
      ok,
      status,
      headers: {
        get: (name: string) =>
          name === "content-length" && contentLength !== undefined ? String(contentLength) : null,
      },
      body: {
        getReader: () => ({ read, cancel }),
      },
    },
    cancel,
    read,
  };
};

describe("fetchSubtitleText", () => {
  beforeEach(() => {
    mockStreamingFetch.mockReset();
  });

  it("decodes a streamed subtitle response", async () => {
    const encoder = new TextEncoder();
    const { response, cancel } = makeResponse({
      chunks: [encoder.encode("caption "), encoder.encode("text")],
      contentLength: 12,
    });
    mockStreamingFetch.mockResolvedValue(response);

    await expect(fetchSubtitleText("https://example.com/captions.srt")).resolves.toBe("caption text");
    expect(cancel).toHaveBeenCalled();
    expect(mockStreamingFetch.mock.calls[0]?.[1].signal.aborted).toBe(true);
  });

  it("rejects a declared file size over the limit before reading the body", async () => {
    const { response, read } = makeResponse({ contentLength: MAX_SUBTITLE_BYTES + 1 });
    mockStreamingFetch.mockResolvedValue(response);

    await expect(fetchSubtitleText("https://example.com/captions.srt")).rejects.toThrow("exceeds");
    expect(read).not.toHaveBeenCalled();
    expect(mockStreamingFetch.mock.calls[0]?.[1].signal.aborted).toBe(true);
  });

  it("cancels an undeclared stream as soon as it exceeds the limit", async () => {
    const { response, cancel } = makeResponse({ chunks: [new Uint8Array(MAX_SUBTITLE_BYTES + 1)] });
    mockStreamingFetch.mockResolvedValue(response);

    await expect(fetchSubtitleText("https://example.com/captions.srt")).rejects.toThrow("exceeds");
    expect(cancel).toHaveBeenCalled();
    expect(mockStreamingFetch.mock.calls[0]?.[1].signal.aborted).toBe(true);
  });

  it("rejects a non-success response", async () => {
    const { response } = makeResponse({ ok: false, status: 403 });
    mockStreamingFetch.mockResolvedValue(response);

    await expect(fetchSubtitleText("https://example.com/captions.srt")).rejects.toThrow("status 403");
  });
});
