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
    getProgress: jest.fn().mockResolvedValue({ position: 60, duration: 300 }),
    getPlaybackState: jest.fn().mockResolvedValue({ state: "playing" }),
    seekTo: jest.fn(),
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
  updateMediaLocation: jest.fn(),
}));

jest.mock("../../components/use-audio-player-sync", () => ({
  isPlayerInitialized: jest.fn().mockReturnValue(true),
}));

import TrackPlayer from "react-native-track-player";
import { playbackService } from "../../components/track-player-service";

const mockTrackPlayer = TrackPlayer as jest.Mocked<typeof TrackPlayer>;

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
    expect(mockTrackPlayer.seekTo).toHaveBeenCalledWith(90);
  });

  it("handles RemoteJumpForward when event is null", async () => {
    await eventHandlers["remote-jump-forward"](null);
    expect(mockTrackPlayer.seekTo).toHaveBeenCalledWith(90);
  });

  it("handles RemoteJumpForward when event is undefined", async () => {
    await eventHandlers["remote-jump-forward"](undefined);
    expect(mockTrackPlayer.seekTo).toHaveBeenCalledWith(90);
  });

  it("handles RemoteJumpBackward with a normal event payload", async () => {
    await eventHandlers["remote-jump-backward"]({ interval: 15 });
    expect(mockTrackPlayer.seekTo).toHaveBeenCalledWith(45);
  });

  it("handles RemoteJumpBackward when event is null", async () => {
    await eventHandlers["remote-jump-backward"](null);
    expect(mockTrackPlayer.seekTo).toHaveBeenCalledWith(45);
  });

  it("clamps RemoteJumpBackward to zero", async () => {
    (mockTrackPlayer.getProgress as jest.Mock).mockResolvedValueOnce({ position: 5, duration: 300 });
    await eventHandlers["remote-jump-backward"]({ interval: 15 });
    expect(mockTrackPlayer.seekTo).toHaveBeenCalledWith(0);
  });
});
