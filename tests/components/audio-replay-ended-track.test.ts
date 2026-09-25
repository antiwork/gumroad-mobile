jest.mock("react-native-track-player", () => ({
  __esModule: true,
  default: {
    setupPlayer: jest.fn().mockResolvedValue(undefined),
    updateOptions: jest.fn().mockResolvedValue(undefined),
    setRepeatMode: jest.fn().mockResolvedValue(undefined),
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    reset: jest.fn().mockResolvedValue(undefined),
    add: jest.fn().mockResolvedValue(undefined),
    skip: jest.fn().mockResolvedValue(undefined),
    seekTo: jest.fn().mockResolvedValue(undefined),
    play: jest.fn().mockResolvedValue(undefined),
    pause: jest.fn().mockResolvedValue(undefined),
    setRate: jest.fn().mockResolvedValue(undefined),
    getQueue: jest.fn().mockResolvedValue([]),
    getActiveTrack: jest.fn().mockResolvedValue(undefined),
    getProgress: jest.fn().mockResolvedValue({ position: 0, duration: 0 }),
    getPlaybackState: jest.fn().mockResolvedValue({ state: "none" }),
  },
  Capability: {
    Play: "play",
    Pause: "pause",
    Stop: "stop",
    SkipToNext: "skip-to-next",
    SkipToPrevious: "skip-to-previous",
    JumpForward: "jump-forward",
    JumpBackward: "jump-backward",
  },
  Event: {
    PlaybackState: "playback-state",
    PlaybackQueueEnded: "playback-queue-ended",
    PlaybackActiveTrackChanged: "playback-active-track-changed",
  },
  RepeatMode: { Off: "off", Queue: "queue" },
  State: { Playing: "playing", Buffering: "buffering", Paused: "paused", Stopped: "stopped", Ended: "ended" },
}));

jest.mock("../../components/full-audio-player", () => ({
  getStoredLoopEnabled: jest.fn().mockResolvedValue(false),
  getStoredPlaybackSpeed: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/audio-player-store", () => ({
  setAudioAccessToken: jest.fn(),
  setAudioContext: jest.fn(),
}));

jest.mock("@/lib/auth-context", () => ({ useAuth: jest.fn().mockReturnValue({ accessToken: null }) }));

jest.mock("@/lib/media-location", () => ({
  ...jest.requireActual("@/lib/media-location"),
  updateMediaLocation: jest.fn(),
}));

/* eslint-disable import/first -- jest.mock calls must precede the imports they affect */
import { useAuth } from "@/lib/auth-context";
import { updateMediaLocation } from "@/lib/media-location";
import { Platform } from "react-native";
import { act, renderHook } from "@testing-library/react-native";
import TrackPlayer from "react-native-track-player";
import type { WebView } from "react-native-webview";
import { playbackService } from "../../components/track-player-service";
import { setupPlayer, useAudioPlayerSync } from "../../components/use-audio-player-sync";

const mockTrackPlayer = TrackPlayer as jest.Mocked<typeof TrackPlayer>;

const track = { uri: "https://example.com/a.mp3", resourceId: "file-1", title: "Episode", contentLength: 300 };
const webViewRef = { current: null } as React.RefObject<WebView | null>;

const playTwice = async (secondState: string, secondProgress: { position: number; duration: number }) => {
  const { result } = renderHook(() => useAudioPlayerSync(webViewRef));

  await act(async () => {
    await result.current.playAudio({ resourceId: track.resourceId, tracks: [track] });
  });
  (mockTrackPlayer.seekTo as jest.Mock).mockClear();

  (mockTrackPlayer.getPlaybackState as jest.Mock).mockResolvedValue({ state: secondState });
  (mockTrackPlayer.getProgress as jest.Mock).mockResolvedValue(secondProgress);

  await act(async () => {
    await result.current.playAudio({ resourceId: track.resourceId, tracks: [track] });
  });
};

describe("replaying the currently loaded track", () => {
  beforeAll(async () => {
    await setupPlayer();
  });

  beforeEach(() => {
    (mockTrackPlayer.seekTo as jest.Mock).mockClear();
    (mockTrackPlayer.play as jest.Mock).mockClear();
    (mockTrackPlayer.getPlaybackState as jest.Mock).mockResolvedValue({ state: "none" });
    (mockTrackPlayer.getProgress as jest.Mock).mockResolvedValue({ position: 0, duration: 0 });
  });

  it("restarts a finished track from the beginning", async () => {
    await playTwice("ended", { position: 300, duration: 300 });

    expect(mockTrackPlayer.seekTo).toHaveBeenCalledWith(0);
    expect(mockTrackPlayer.play).toHaveBeenCalled();
  });

  it("restarts from the beginning when parked at the end even without an ended state", async () => {
    await playTwice("paused", { position: 299.8, duration: 300 });

    expect(mockTrackPlayer.seekTo).toHaveBeenCalledWith(0);
  });

  it("does not seek when resuming a paused track mid-way", async () => {
    await playTwice("paused", { position: 60, duration: 300 });

    expect(mockTrackPlayer.seekTo).not.toHaveBeenCalled();
    expect(mockTrackPlayer.play).toHaveBeenCalled();
  });
});

describe("saved audio restoration and live continuity", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockTrackPlayer.getProgress as jest.Mock).mockResolvedValue({ position: 0, duration: 0 });
    (mockTrackPlayer.getPlaybackState as jest.Mock).mockResolvedValue({ state: "none" });
  });

  afterEach(() => {
    (mockTrackPlayer.getActiveTrack as jest.Mock).mockResolvedValue(undefined);
  });

  it.each([300, 580, 590])("continues a live pause at %s/600 from the purchase-row entry point", async (position) => {
    const { result } = renderHook(() => useAudioPlayerSync(webViewRef));
    const options = { resourceId: track.resourceId, tracks: [{ ...track, contentLength: 600 }] };
    await act(async () => {
      await result.current.playAudio(options);
    });
    (mockTrackPlayer.getProgress as jest.Mock).mockResolvedValue({ position, duration: 600 });
    await act(async () => {
      await result.current.pauseAudio();
    });
    (mockTrackPlayer.getPlaybackState as jest.Mock).mockResolvedValue({ state: "paused" });
    mockTrackPlayer.seekTo.mockClear();
    await act(async () => {
      await result.current.playAudio(options);
    });
    expect(mockTrackPlayer.seekTo).not.toHaveBeenCalled();
    expect(mockTrackPlayer.pause).toHaveBeenCalled();
    expect(mockTrackPlayer.play).toHaveBeenCalledTimes(2);
  });

  it.each([
    [600, 300, 300],
    [600, 590, 0],
    [600, 600, 0],
    [600, 610, 0],
    [10, 9.499, 9.499],
    [10, 9.5, 0],
    [10, 9.501, 0],
    [0, 120, 120],
  ])("restores saved %s seconds / %s to %s using the loaded duration", async (duration, saved, expected) => {
    (mockTrackPlayer.getProgress as jest.Mock).mockResolvedValue({ position: 0, duration });
    const { result } = renderHook(() => useAudioPlayerSync(webViewRef));
    await act(async () => {
      await result.current.playAudio({
        resourceId: track.resourceId,
        tracks: [{ ...track, contentLength: undefined, resumeAt: saved }],
      });
    });
    if (expected) expect(mockTrackPlayer.seekTo).toHaveBeenCalledWith(expected);
    else expect(mockTrackPlayer.seekTo).not.toHaveBeenCalled();
  });

  it("replays when a provisional exact-end seek stops before duration becomes available", async () => {
    const { result } = renderHook(() => useAudioPlayerSync(webViewRef));
    await act(async () => {
      await result.current.playAudio({
        resourceId: track.resourceId,
        tracks: [{ ...track, contentLength: undefined, resumeAt: 600 }],
      });
    });
    (mockTrackPlayer.getActiveTrack as jest.Mock).mockResolvedValue({ id: track.resourceId });
    (mockTrackPlayer.getProgress as jest.Mock).mockResolvedValue({ position: 600, duration: 600 });
    const listener = (mockTrackPlayer.addEventListener as jest.Mock).mock.calls.find(
      ([event]) => event === "playback-state",
    )[1];
    await act(async () => {
      await listener({ state: "ended" });
    });
    expect(mockTrackPlayer.seekTo).toHaveBeenLastCalledWith(0);
    expect(mockTrackPlayer.play).toHaveBeenCalledTimes(2);
  });

  it("rechecks a saved position when duration arrives after playback starts, only once", async () => {
    jest.useFakeTimers();
    const { result, unmount } = renderHook(() => useAudioPlayerSync(webViewRef));
    await act(async () => {
      await result.current.playAudio({
        resourceId: track.resourceId,
        tracks: [{ ...track, contentLength: undefined, resumeAt: 590 }],
      });
    });
    expect(mockTrackPlayer.seekTo).toHaveBeenCalledWith(590);
    (mockTrackPlayer.getActiveTrack as jest.Mock).mockResolvedValue({ id: track.resourceId });
    (mockTrackPlayer.getProgress as jest.Mock).mockResolvedValue({ position: 590, duration: 600 });
    (mockTrackPlayer.getPlaybackState as jest.Mock).mockResolvedValue({ state: "playing" });
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(mockTrackPlayer.seekTo).toHaveBeenLastCalledWith(0);
    mockTrackPlayer.seekTo.mockClear();
    (mockTrackPlayer.getProgress as jest.Mock).mockResolvedValue({ position: 580, duration: 600 });
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(mockTrackPlayer.seekTo).not.toHaveBeenCalled();
    unmount();
    jest.useRealTimers();
  });
});

describe("cross-platform audio persistence contract", () => {
  it.each(["ios", "android"])("saves %s progress via the API and reopens the latest platform row", async (platform) => {
    jest.clearAllMocks();
    const originalPlatform = Platform.OS;
    Object.defineProperty(Platform, "OS", { configurable: true, value: platform });
    (useAuth as jest.Mock).mockReturnValue({ accessToken: "test-access-token" });
    (updateMediaLocation as jest.Mock).mockImplementation(
      jest.requireActual("@/lib/media-location").updateMediaLocation,
    );
    const rows = new Map<string, { location: number; platform: string }>([["web", { location: 300, platform: "web" }]]);
    const fetch = jest.spyOn(global, "fetch").mockImplementation(async (_url, options) => {
      const body = JSON.parse(String(options?.body));
      expect(body).toEqual(
        expect.objectContaining({
          product_file_id: "file-1",
          url_redirect_id: "redirect-1",
          purchase_id: "purchase-1",
        }),
      );
      rows.set(body.platform, body);
      return { ok: true, status: 200, text: async () => "{}" } as Response;
    });
    const audio = {
      ...track,
      contentLength: undefined,
      urlRedirectId: "redirect-1",
      purchaseId: "purchase-1",
      resumeAt: rows.get("web")!.location,
    };
    (mockTrackPlayer.getPlaybackState as jest.Mock).mockResolvedValue({ state: "paused" });
    (mockTrackPlayer.getProgress as jest.Mock).mockResolvedValue({ position: 0, duration: 600 });
    const first = renderHook(() => useAudioPlayerSync(webViewRef));
    await act(async () => {
      await first.result.current.playAudio({ resourceId: track.resourceId, tracks: [audio] });
    });
    expect(mockTrackPlayer.seekTo).toHaveBeenLastCalledWith(300);
    (mockTrackPlayer.getProgress as jest.Mock).mockResolvedValue({ position: 120, duration: 600 });
    await act(async () => {
      await first.result.current.pauseAudio();
    });
    const nativePlatform = platform === "ios" ? "iphone" : "android";
    expect(rows.get(nativePlatform)?.location).toBe(120);
    (mockTrackPlayer.getProgress as jest.Mock).mockResolvedValue({ position: 580, duration: 600 });
    await act(async () => {
      await first.result.current.pauseAudio();
    });
    expect(rows.get(nativePlatform)?.location).toBe(600);
    expect(rows.size).toBe(2);
    await act(async () => first.unmount());
    mockTrackPlayer.seekTo.mockClear();
    (mockTrackPlayer.getProgress as jest.Mock).mockResolvedValue({ position: 0, duration: 600 });
    const reopened = renderHook(() => useAudioPlayerSync(webViewRef));
    await act(async () => {
      await reopened.result.current.playAudio({
        resourceId: track.resourceId,
        tracks: [{ ...audio, resumeAt: rows.get(nativePlatform)!.location }],
      });
    });
    expect(mockTrackPlayer.seekTo).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/mobile/media_locations"),
      expect.objectContaining({ method: "POST" }),
    );
    await act(async () => reopened.unmount());
    fetch.mockRestore();
    (updateMediaLocation as jest.Mock).mockReset();
    (useAuth as jest.Mock).mockReturnValue({ accessToken: null });
    Object.defineProperty(Platform, "OS", { configurable: true, value: originalPlatform });
  });
});

describe("round two delayed audio restore lifecycle", () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    audio.contentLength = 600;
    (updateMediaLocation as jest.Mock).mockResolvedValue(undefined);
    (mockTrackPlayer.getActiveTrack as jest.Mock).mockResolvedValue(undefined);
    (mockTrackPlayer.getQueue as jest.Mock).mockResolvedValue([]);
    (mockTrackPlayer.getPlaybackState as jest.Mock).mockResolvedValue({ state: "playing" });
    (mockTrackPlayer.getProgress as jest.Mock).mockResolvedValue({ position: 0, duration: 0 });
    await setupPlayer();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  const startService = async () => {
    Object.assign(jest.requireMock("@/lib/audio-player-store"), {
      getAudioAccessToken: jest.fn().mockReturnValue("test-token"),
      getAudioContext: jest.fn().mockReturnValue(null),
    });
    Object.assign(jest.requireMock("react-native-track-player").Event, { RemoteJumpBackward: "remote-jump-backward" });
    mockTrackPlayer.seekBy = jest.fn().mockResolvedValue(undefined);
    await playbackService();
  };

  const audio = { ...track, contentLength: 600, resumeAt: 580, urlRedirectId: "redirect-1" };
  const poll = async () => {
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
  };

  it.each([580, 600, 660])("reconciles saved 580 with metadata 600 and delayed duration %s once", async (duration) => {
    const { result, unmount } = renderHook(() => useAudioPlayerSync(webViewRef));
    await act(async () => {
      await result.current.playAudio({ resourceId: audio.resourceId, tracks: [audio] });
    });
    expect(mockTrackPlayer.seekTo).not.toHaveBeenCalled();
    (mockTrackPlayer.getActiveTrack as jest.Mock).mockResolvedValue({ id: track.resourceId });
    (mockTrackPlayer.getProgress as jest.Mock).mockResolvedValue({ position: 5, duration: 0 });
    await poll();
    await poll();
    expect(updateMediaLocation).not.toHaveBeenCalled();
    (mockTrackPlayer.getProgress as jest.Mock).mockResolvedValue({ position: 5, duration });
    await poll();
    if (duration === 660) {
      expect(mockTrackPlayer.seekTo).toHaveBeenCalledTimes(1);
      expect(mockTrackPlayer.seekTo).toHaveBeenLastCalledWith(580);
      expect(updateMediaLocation).toHaveBeenLastCalledWith(expect.objectContaining({ location: 580 }));
    } else {
      expect(mockTrackPlayer.seekTo).not.toHaveBeenCalled();
      expect(updateMediaLocation).toHaveBeenLastCalledWith(expect.objectContaining({ location: 5 }));
    }
    mockTrackPlayer.seekTo.mockClear();
    (mockTrackPlayer.getProgress as jest.Mock).mockResolvedValue({ position: 590, duration });
    await poll();
    expect(mockTrackPlayer.seekTo).not.toHaveBeenCalled();
    unmount();
  });

  it("keeps already-playing drift when the provisional seek remains resumable", async () => {
    const { result, unmount } = renderHook(() => useAudioPlayerSync(webViewRef));
    await act(async () => {
      await result.current.playAudio({
        resourceId: audio.resourceId,
        tracks: [{ ...audio, contentLength: undefined }],
      });
    });
    expect(mockTrackPlayer.seekTo).toHaveBeenCalledWith(580);
    mockTrackPlayer.seekTo.mockClear();
    (mockTrackPlayer.getProgress as jest.Mock).mockResolvedValue({ position: 585, duration: 660 });
    await poll();
    expect(mockTrackPlayer.seekTo).not.toHaveBeenCalled();
    expect(updateMediaLocation).toHaveBeenLastCalledWith(expect.objectContaining({ location: 585 }));
    unmount();
  });

  it.each([600, 660])("preserves a deliberate seek while duration %s is pending", async (duration) => {
    const { result, unmount } = renderHook(() => useAudioPlayerSync(webViewRef));
    await act(async () => {
      await result.current.playAudio({ resourceId: audio.resourceId, tracks: [audio] });
    });
    await startService();
    const listener = (mockTrackPlayer.addEventListener as jest.Mock).mock.calls.find(
      ([event]) => event === "remote-jump-backward",
    )[1];
    await act(async () => {
      await listener({ interval: 340 });
    });
    expect(mockTrackPlayer.seekBy).toHaveBeenCalledWith(-340);
    mockTrackPlayer.seekTo.mockClear();
    (mockTrackPlayer.getProgress as jest.Mock).mockResolvedValue({ position: 240, duration });
    await poll();
    expect(mockTrackPlayer.seekTo).not.toHaveBeenCalled();
    expect(updateMediaLocation).toHaveBeenLastCalledWith(expect.objectContaining({ location: 240 }));
    unmount();
  });

  it("resolves a paused restore after duration arrives without starting playback", async () => {
    const { result, unmount } = renderHook(() => useAudioPlayerSync(webViewRef));
    await act(async () => {
      await result.current.playAudio({ resourceId: audio.resourceId, tracks: [audio] });
    });
    await act(async () => {
      await result.current.pauseAudio();
    });
    mockTrackPlayer.play.mockClear();
    (mockTrackPlayer.getPlaybackState as jest.Mock).mockResolvedValue({ state: "paused" });
    (mockTrackPlayer.getActiveTrack as jest.Mock).mockResolvedValue({ id: track.resourceId });
    (mockTrackPlayer.getProgress as jest.Mock).mockResolvedValue({ position: 0, duration: 660 });
    await poll();
    expect(mockTrackPlayer.seekTo).toHaveBeenLastCalledWith(580);
    expect(mockTrackPlayer.play).not.toHaveBeenCalled();
    unmount();
  });

  it("drops the old pending restore when the queue changes tracks", async () => {
    const other = { ...audio, resourceId: "file-2", resumeAt: undefined };
    const { result, unmount } = renderHook(() => useAudioPlayerSync(webViewRef));
    await act(async () => {
      await result.current.playAudio({ resourceId: audio.resourceId, tracks: [audio, other] });
    });
    const listener = (mockTrackPlayer.addEventListener as jest.Mock).mock.calls.find(
      ([event]) => event === "playback-active-track-changed",
    )[1];
    await act(async () => {
      await listener({ track: { id: other.resourceId }, lastPosition: 5 });
    });
    expect(updateMediaLocation).not.toHaveBeenCalled();
    (mockTrackPlayer.getProgress as jest.Mock).mockResolvedValue({ position: 20, duration: 660 });
    await poll();
    expect(mockTrackPlayer.seekTo).not.toHaveBeenCalled();
    expect(updateMediaLocation).toHaveBeenLastCalledWith(
      expect.objectContaining({ productFileId: "file-2", location: 20 }),
    );
    unmount();
  });

  it("rehydrates a paused queue and reverses metadata completion when duration arrives", async () => {
    const nativeTrack = { ...audio, id: audio.resourceId, url: audio.uri };
    (mockTrackPlayer.getActiveTrack as jest.Mock).mockResolvedValue(nativeTrack);
    (mockTrackPlayer.getQueue as jest.Mock).mockResolvedValue([nativeTrack]);
    (mockTrackPlayer.getPlaybackState as jest.Mock).mockResolvedValue({ state: "paused" });
    const { unmount } = renderHook(() => useAudioPlayerSync(webViewRef));
    await act(async () => {});
    expect(mockTrackPlayer.seekTo).not.toHaveBeenCalled();
    (mockTrackPlayer.getProgress as jest.Mock).mockResolvedValue({ position: 0, duration: 660 });
    await poll();
    expect(mockTrackPlayer.seekTo).toHaveBeenLastCalledWith(580);
    expect(mockTrackPlayer.play).not.toHaveBeenCalled();
    unmount();
  });

  it("keeps pending duration across unmount for the background service without provisional writes", async () => {
    const { result, unmount } = renderHook(() => useAudioPlayerSync(webViewRef));
    await act(async () => {
      await result.current.playAudio({ resourceId: audio.resourceId, tracks: [audio] });
    });
    await act(async () => {
      unmount();
    });
    (mockTrackPlayer.getActiveTrack as jest.Mock).mockResolvedValue({
      id: audio.resourceId,
      urlRedirectId: audio.urlRedirectId,
    });
    await startService();
    (mockTrackPlayer.getProgress as jest.Mock).mockResolvedValue({ position: 5, duration: 0 });
    await poll();
    expect(updateMediaLocation).not.toHaveBeenCalled();
    (mockTrackPlayer.getProgress as jest.Mock).mockResolvedValue({ position: 5, duration: 660 });
    await poll();
    expect(mockTrackPlayer.seekTo).toHaveBeenLastCalledWith(580);
    expect(updateMediaLocation).toHaveBeenLastCalledWith(expect.objectContaining({ location: 580 }));
  });

  it("does not duplicate or save a restore while a native seek is still pending", async () => {
    const { result, unmount } = renderHook(() => useAudioPlayerSync(webViewRef));
    await act(async () => {
      await result.current.playAudio({ resourceId: audio.resourceId, tracks: [audio] });
    });
    let finishSeek!: () => void;
    mockTrackPlayer.seekTo.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishSeek = resolve;
        }),
    );
    (mockTrackPlayer.getActiveTrack as jest.Mock).mockResolvedValue({ id: track.resourceId });
    (mockTrackPlayer.getProgress as jest.Mock).mockResolvedValue({ position: 5, duration: 660 });
    await poll();
    await poll();
    expect(mockTrackPlayer.seekTo).toHaveBeenCalledTimes(1);
    expect(updateMediaLocation).not.toHaveBeenCalled();
    await act(async () => {
      finishSeek();
    });
    expect(updateMediaLocation).toHaveBeenLastCalledWith(expect.objectContaining({ location: 580 }));
    unmount();
  });

  it("saves progress when the native duration never arrives", async () => {
    const { result, unmount } = renderHook(() => useAudioPlayerSync(webViewRef));
    await act(async () => {
      await result.current.playAudio({ resourceId: audio.resourceId, tracks: [audio] });
    });
    (mockTrackPlayer.getActiveTrack as jest.Mock).mockResolvedValue({ id: track.resourceId });
    (mockTrackPlayer.getProgress as jest.Mock).mockResolvedValue({ position: 5, duration: 0 });
    await poll();
    expect(updateMediaLocation).not.toHaveBeenCalled();
    await poll();
    await poll();
    await poll();
    await poll();
    expect(mockTrackPlayer.seekTo).not.toHaveBeenCalled();
    expect(updateMediaLocation).toHaveBeenLastCalledWith(expect.objectContaining({ location: 5 }));
    unmount();
  });

  it("drops a pending restore when the background queue advances and later revisits the track", async () => {
    const { result, unmount } = renderHook(() => useAudioPlayerSync(webViewRef));
    await act(async () => {
      await result.current.playAudio({ resourceId: audio.resourceId, tracks: [audio] });
    });
    await act(async () => {
      unmount();
    });
    await startService();
    (mockTrackPlayer.getActiveTrack as jest.Mock).mockResolvedValue({ id: "file-2", urlRedirectId: "redirect-1" });
    (mockTrackPlayer.getProgress as jest.Mock).mockResolvedValue({ position: 20, duration: 660 });
    await poll();
    expect(updateMediaLocation).toHaveBeenLastCalledWith(
      expect.objectContaining({ productFileId: "file-2", location: 20 }),
    );
    (mockTrackPlayer.getActiveTrack as jest.Mock).mockResolvedValue({
      id: audio.resourceId,
      urlRedirectId: audio.urlRedirectId,
    });
    await poll();
    expect(mockTrackPlayer.seekTo).not.toHaveBeenCalled();
    expect(updateMediaLocation).toHaveBeenLastCalledWith(
      expect.objectContaining({ productFileId: audio.resourceId, location: 20 }),
    );
  });

  it("round three preserves a mounted pause while the corrective native seek resolves", async () => {
    const { result, unmount } = renderHook(() => useAudioPlayerSync(webViewRef));
    await act(async () => {
      await result.current.playAudio({ resourceId: audio.resourceId, tracks: [audio] });
    });
    let finishSeek!: () => void;
    mockTrackPlayer.seekTo.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishSeek = resolve;
        }),
    );
    (mockTrackPlayer.getActiveTrack as jest.Mock).mockResolvedValue({ id: track.resourceId });
    (mockTrackPlayer.getProgress as jest.Mock).mockResolvedValue({ position: 5, duration: 660 });
    await poll();
    expect(mockTrackPlayer.seekTo).toHaveBeenCalledWith(580);
    await act(async () => {
      await result.current.pauseAudio();
    });
    mockTrackPlayer.play.mockClear();
    expect(updateMediaLocation).not.toHaveBeenCalled();
    await act(async () => {
      finishSeek();
    });
    expect(mockTrackPlayer.play).not.toHaveBeenCalled();
    expect(updateMediaLocation).toHaveBeenLastCalledWith(
      expect.objectContaining({ productFileId: audio.resourceId, location: 580 }),
    );
    unmount();
  });

  it.each([true, false])(
    "round three suppresses provisional outgoing progress with the service registered first: %s",
    async (serviceFirst) => {
      if (serviceFirst) await startService();
      const other = { ...audio, resourceId: "file-2", resumeAt: undefined };
      const { result, unmount } = renderHook(() => useAudioPlayerSync(webViewRef));
      await act(async () => {
        await result.current.playAudio({ resourceId: audio.resourceId, tracks: [audio, other] });
      });
      if (!serviceFirst) await startService();
      (mockTrackPlayer.getActiveTrack as jest.Mock).mockResolvedValue({
        id: other.resourceId,
        urlRedirectId: other.urlRedirectId,
      });
      const listeners = (mockTrackPlayer.addEventListener as jest.Mock).mock.calls.filter(
        ([event]) => event === "playback-active-track-changed",
      );
      await act(async () => {
        await Promise.all(
          listeners.map(([, listener]) => listener({ track: { id: other.resourceId }, lastPosition: 5 })),
        );
      });
      expect(mockTrackPlayer.seekTo).not.toHaveBeenCalled();
      expect(updateMediaLocation).not.toHaveBeenCalled();
      (mockTrackPlayer.getProgress as jest.Mock).mockResolvedValue({ position: 20, duration: 660 });
      await poll();
      expect(updateMediaLocation).toHaveBeenLastCalledWith(
        expect.objectContaining({ productFileId: other.resourceId, location: 20 }),
      );
      unmount();
    },
  );
});
