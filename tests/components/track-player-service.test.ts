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
