const eventHandlers: Record<string, (event: unknown) => Promise<void>> = {};

jest.mock("react-native-track-player", () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn((event: string, handler: (event: unknown) => Promise<void>) => {
      eventHandlers[event] = handler;
      return { remove: jest.fn() };
    }),
    play: jest.fn(),
    pause: jest.fn(),
    stop: jest.fn(),
    getQueue: jest.fn().mockResolvedValue([]),
    getActiveTrackIndex: jest.fn().mockResolvedValue(0),
    getActiveTrack: jest.fn().mockResolvedValue(undefined),
    getProgress: jest.fn().mockResolvedValue({ position: 60, duration: 300 }),
    getPlaybackState: jest.fn().mockResolvedValue({ state: "playing" }),
    seekTo: jest.fn(),
    seekBy: jest.fn(),
    skipToNext: jest.fn(),
    skipToPrevious: jest.fn(),
  },
  Event: {
    RemotePlay: "remote-play",
    RemotePause: "remote-pause",
    RemoteStop: "remote-stop",
    RemoteNext: "remote-next",
    RemotePrevious: "remote-previous",
    RemoteJumpForward: "remote-jump-forward",
    RemoteJumpBackward: "remote-jump-backward",
    PlaybackState: "playback-state",
    PlaybackQueueEnded: "playback-queue-ended",
    PlaybackActiveTrackChanged: "playback-active-track-changed",
  },
  State: { Playing: "playing", Paused: "paused", Stopped: "stopped" },
}));

jest.mock("@/lib/audio-player-store", () => ({
  getAudioContext: jest.fn().mockReturnValue(null),
  getAudioAccessToken: jest.fn().mockReturnValue(null),
}));

jest.mock("@/lib/media-location", () => ({
  ...jest.requireActual("@/lib/media-location"),
  updateMediaLocation: jest.fn(),
}));

jest.mock("../../components/use-audio-player-sync", () => ({
  isPlayerInitialized: jest.fn().mockReturnValue(true),
}));

import TrackPlayer from "react-native-track-player";
import { getPendingAudioRestore, setPendingAudioRestore } from "@/lib/audio-seek";
import { getAudioAccessToken, getAudioContext } from "@/lib/audio-player-store";
import { updateMediaLocation } from "@/lib/media-location";
import { playbackService } from "../../components/track-player-service";

const mockTrackPlayer = TrackPlayer as jest.Mocked<typeof TrackPlayer>;
const mockGetAudioContext = getAudioContext as jest.Mock;
const mockGetAudioAccessToken = getAudioAccessToken as jest.Mock;
const mockUpdateMediaLocation = updateMediaLocation as jest.Mock;

describe("playbackService", () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    Object.keys(eventHandlers).forEach((key) => delete eventHandlers[key]);
    (mockTrackPlayer.getProgress as jest.Mock).mockResolvedValue({ position: 60, duration: 300 });
    await playbackService();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("handles RemoteJumpForward with a normal event payload", async () => {
    await eventHandlers["remote-jump-forward"]({ interval: 30 });
    expect(mockTrackPlayer.seekBy).toHaveBeenCalledWith(30);
  });

  it("handles RemoteJumpForward when event is null", async () => {
    await eventHandlers["remote-jump-forward"](null);
    expect(mockTrackPlayer.seekBy).toHaveBeenCalledWith(30);
  });

  it("handles RemoteJumpForward when event is undefined", async () => {
    await eventHandlers["remote-jump-forward"](undefined);
    expect(mockTrackPlayer.seekBy).toHaveBeenCalledWith(30);
  });

  it("handles RemoteJumpBackward with a normal event payload", async () => {
    await eventHandlers["remote-jump-backward"]({ interval: 15 });
    expect(mockTrackPlayer.seekBy).toHaveBeenCalledWith(-15);
  });

  it("handles RemoteJumpBackward when event is null", async () => {
    await eventHandlers["remote-jump-backward"](null);
    expect(mockTrackPlayer.seekBy).toHaveBeenCalledWith(-15);
  });

  it("handles RemoteJumpBackward when event is undefined", async () => {
    await eventHandlers["remote-jump-backward"](undefined);
    expect(mockTrackPlayer.seekBy).toHaveBeenCalledWith(-15);
  });
});

describe("syncCurrentPosition via remote pause", () => {
  const remotePause = () => eventHandlers["remote-pause"](undefined);

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    Object.keys(eventHandlers).forEach((key) => delete eventHandlers[key]);
    (mockTrackPlayer.getProgress as jest.Mock).mockResolvedValue({ position: 60, duration: 300 });
    mockGetAudioAccessToken.mockReturnValue("token-1");
    await playbackService();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("saves against the native active track's identifiers", async () => {
    mockGetAudioContext.mockReturnValue({ resourceId: "stale-file", urlRedirectId: "stale-redirect" });
    (mockTrackPlayer.getActiveTrack as jest.Mock).mockResolvedValue({
      id: "file-2",
      urlRedirectId: "redirect-2",
      purchaseId: "purchase-2",
    });

    await remotePause();

    expect(mockUpdateMediaLocation).toHaveBeenCalledWith(
      expect.objectContaining({
        urlRedirectId: "redirect-2",
        productFileId: "file-2",
        purchaseId: "purchase-2",
        location: 60,
        accessToken: "token-1",
      }),
    );
  });

  it("falls back to the store context when the active track has no identifiers", async () => {
    mockGetAudioContext.mockReturnValue({
      resourceId: "file-3",
      urlRedirectId: "redirect-3",
      purchaseId: "purchase-3",
    });
    (mockTrackPlayer.getActiveTrack as jest.Mock).mockResolvedValue(undefined);

    await remotePause();

    expect(mockUpdateMediaLocation).toHaveBeenCalledWith(
      expect.objectContaining({ urlRedirectId: "redirect-3", productFileId: "file-3", purchaseId: "purchase-3" }),
    );
  });

  it("skips the save when neither the track nor the store identifies the file", async () => {
    mockGetAudioContext.mockReturnValue(null);
    (mockTrackPlayer.getActiveTrack as jest.Mock).mockResolvedValue(undefined);

    await remotePause();

    expect(mockUpdateMediaLocation).not.toHaveBeenCalled();
  });

  it("skips the save for positions under 3 seconds so a restarted track cannot clobber progress", async () => {
    mockGetAudioContext.mockReturnValue({ resourceId: "file-4", urlRedirectId: "redirect-4" });
    (mockTrackPlayer.getProgress as jest.Mock).mockResolvedValue({ position: 1, duration: 300 });

    await remotePause();

    expect(mockUpdateMediaLocation).not.toHaveBeenCalled();
  });
});

describe("round three background restore ownership", () => {
  const trackA = {
    url: "https://example.com/a.mp3",
    id: "file-a",
    urlRedirectId: "redirect-a",
    purchaseId: "purchase-a",
  };
  const trackB = {
    url: "https://example.com/b.mp3",
    id: "file-b",
    urlRedirectId: "redirect-b",
    purchaseId: "purchase-b",
  };
  const poll = () => jest.advanceTimersByTimeAsync(5000);

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    Object.keys(eventHandlers).forEach((key) => delete eventHandlers[key]);
    mockGetAudioAccessToken.mockReturnValue("token-1");
    mockGetAudioContext.mockReturnValue({ resourceId: trackA.id, urlRedirectId: trackA.urlRedirectId });
    mockTrackPlayer.getActiveTrack.mockResolvedValue(trackA);
    mockTrackPlayer.getProgress.mockResolvedValue({ position: 5, duration: 660, buffered: 0 });
    (mockTrackPlayer.getPlaybackState as jest.Mock).mockResolvedValue({ state: "playing" });
    setPendingAudioRestore({ resourceId: trackA.id, position: 580, provisionalPosition: 0 });
    await playbackService();
  });

  afterEach(() => {
    setPendingAudioRestore(null);
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it.each(["pause", "stop"])("preserves remote %s intent through a deferred seek", async (action) => {
    let finishSeek!: () => void;
    mockTrackPlayer.seekTo.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishSeek = resolve;
        }),
    );
    await poll();
    expect(mockTrackPlayer.seekTo).toHaveBeenCalledWith(580);
    await eventHandlers[`remote-${action}`](undefined);
    expect(mockUpdateMediaLocation).not.toHaveBeenCalled();
    finishSeek();
    await jest.advanceTimersByTimeAsync(0);
    expect(mockTrackPlayer.play).not.toHaveBeenCalled();
    expect(mockUpdateMediaLocation).toHaveBeenLastCalledWith(
      expect.objectContaining({ productFileId: trackA.id, location: 580 }),
    );
  });

  it("preserves remote play intent after a pause during a deferred seek", async () => {
    let finishSeek!: () => void;
    mockTrackPlayer.seekTo.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishSeek = resolve;
        }),
    );
    (mockTrackPlayer.getPlaybackState as jest.Mock).mockResolvedValue({ state: "paused" });
    await poll();
    await eventHandlers["remote-pause"](undefined);
    await eventHandlers["remote-play"](undefined);
    mockTrackPlayer.play.mockClear();
    finishSeek();
    await jest.advanceTimersByTimeAsync(0);
    expect(mockTrackPlayer.play).toHaveBeenCalledTimes(1);
    expect(mockUpdateMediaLocation).toHaveBeenLastCalledWith(
      expect.objectContaining({ productFileId: trackA.id, location: 580 }),
    );
  });

  it.each(["progress", "playback state"])("invalidates track A while its %s read is deferred", async (read) => {
    let finishRead!: () => void;
    if (read === "progress") {
      mockTrackPlayer.getProgress.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishRead = () => resolve({ position: 5, duration: 660, buffered: 0 });
          }),
      );
    } else {
      (mockTrackPlayer.getPlaybackState as jest.Mock)
        .mockResolvedValueOnce({ state: "playing" })
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              finishRead = () => resolve({ state: "playing" });
            }),
        );
    }
    await poll();
    expect(finishRead).toBeDefined();
    mockTrackPlayer.getActiveTrack.mockResolvedValue(trackB);
    await eventHandlers["playback-active-track-changed"]?.({ track: trackB, lastPosition: 5 });
    finishRead();
    await jest.advanceTimersByTimeAsync(0);
    expect(mockTrackPlayer.seekTo).not.toHaveBeenCalled();
    expect(mockTrackPlayer.play).not.toHaveBeenCalled();
    expect(mockUpdateMediaLocation).not.toHaveBeenCalled();
    expect(getPendingAudioRestore()).toMatchObject({ resourceId: trackA.id, cancelled: true });
    mockTrackPlayer.getProgress.mockResolvedValue({ position: 20, duration: 660, buffered: 0 });
    await poll();
    expect(mockUpdateMediaLocation).toHaveBeenCalledTimes(1);
    expect(mockUpdateMediaLocation).toHaveBeenLastCalledWith(
      expect.objectContaining({ productFileId: trackB.id, urlRedirectId: trackB.urlRedirectId, location: 20 }),
    );
  });

  it("rechecks the native source before seeking even if the track event has not arrived", async () => {
    let finishProgress!: () => void;
    mockTrackPlayer.getProgress.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishProgress = () => resolve({ position: 5, duration: 660, buffered: 0 });
        }),
    );
    await poll();
    mockTrackPlayer.getActiveTrack.mockResolvedValue(trackB);
    finishProgress();
    await jest.advanceTimersByTimeAsync(0);
    expect(mockTrackPlayer.seekTo).not.toHaveBeenCalled();
    expect(mockUpdateMediaLocation).not.toHaveBeenCalled();
  });

  it.each([true, false])(
    "discards late seek completion after switching from A to B (event delivered: %s)",
    async (deliverEvent) => {
      let finishSeek!: () => void;
      mockTrackPlayer.seekTo.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finishSeek = resolve;
          }),
      );
      await poll();
      expect(mockTrackPlayer.seekTo).toHaveBeenCalledWith(580);
      mockTrackPlayer.getActiveTrack.mockResolvedValue(trackB);
      if (deliverEvent) await eventHandlers["playback-active-track-changed"]?.({ track: trackB, lastPosition: 5 });
      finishSeek();
      await jest.advanceTimersByTimeAsync(0);
      expect(mockTrackPlayer.play).not.toHaveBeenCalled();
      expect(mockUpdateMediaLocation).not.toHaveBeenCalled();
      mockTrackPlayer.getProgress.mockResolvedValue({ position: 20, duration: 660, buffered: 0 });
      await poll();
      expect(mockTrackPlayer.seekTo).toHaveBeenCalledTimes(1);
      expect(mockUpdateMediaLocation).toHaveBeenCalledTimes(1);
      expect(mockUpdateMediaLocation).toHaveBeenLastCalledWith(
        expect.objectContaining({ productFileId: trackB.id, location: 20 }),
      );
    },
  );

  it("rejects progress from an earlier visit when the native queue returns to A", async () => {
    let finishProgress!: () => void;
    mockTrackPlayer.getProgress.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishProgress = () => resolve({ position: 5, duration: 660, buffered: 0 });
        }),
    );
    await poll();
    await eventHandlers["playback-active-track-changed"]?.({ track: trackB, lastPosition: 5 });
    await eventHandlers["playback-active-track-changed"]?.({ track: trackA, lastPosition: 0 });
    finishProgress();
    await jest.advanceTimersByTimeAsync(0);
    expect(mockTrackPlayer.seekTo).not.toHaveBeenCalled();
    expect(mockUpdateMediaLocation).not.toHaveBeenCalled();
  });

  it("rechecks the native source before saving after an asynchronous play completes", async () => {
    let finishPlay!: () => void;
    mockTrackPlayer.play.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishPlay = resolve;
        }),
    );
    await poll();
    expect(mockTrackPlayer.seekTo).toHaveBeenCalledWith(580);
    expect(mockTrackPlayer.play).toHaveBeenCalledTimes(1);
    mockTrackPlayer.getActiveTrack.mockResolvedValue(trackB);
    finishPlay();
    await jest.advanceTimersByTimeAsync(0);
    expect(mockUpdateMediaLocation).not.toHaveBeenCalled();
  });

  it("guards the final save when no corrective seek was necessary", async () => {
    mockTrackPlayer.getProgress.mockResolvedValue({ position: 5, duration: 600, buffered: 0 });
    mockTrackPlayer.getActiveTrack
      .mockResolvedValueOnce(trackA)
      .mockResolvedValueOnce(trackA)
      .mockResolvedValue(trackB);
    await poll();
    expect(mockTrackPlayer.seekTo).not.toHaveBeenCalled();
    expect(mockUpdateMediaLocation).not.toHaveBeenCalled();
  });

  it("does not resume a cancelled seek when the queue returns to A before completion", async () => {
    let finishSeek!: () => void;
    mockTrackPlayer.seekTo.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishSeek = resolve;
        }),
    );
    await poll();
    expect(mockTrackPlayer.seekTo).toHaveBeenCalledWith(580);
    await eventHandlers["playback-active-track-changed"]?.({ track: trackB, lastPosition: 5 });
    await eventHandlers["playback-active-track-changed"]?.({ track: trackA, lastPosition: 0 });
    finishSeek();
    await jest.advanceTimersByTimeAsync(0);
    expect(mockTrackPlayer.play).not.toHaveBeenCalled();
    expect(mockUpdateMediaLocation).not.toHaveBeenCalled();
  });
});
