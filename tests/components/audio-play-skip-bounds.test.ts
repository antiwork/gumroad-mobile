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
import { act, renderHook } from "@testing-library/react-native";
import TrackPlayer from "react-native-track-player";
import type { WebView } from "react-native-webview";
import { setupPlayer, useAudioPlayerSync } from "../../components/use-audio-player-sync";

const mockTrackPlayer = TrackPlayer as jest.Mocked<typeof TrackPlayer>;

const tracks = [
  { uri: "https://example.com/a.mp3", resourceId: "file-1", title: "Track 1", contentLength: 300 },
  { uri: "https://example.com/b.mp3", resourceId: "file-2", title: "Track 2", contentLength: 300 },
];
const webViewRef = { current: null } as React.RefObject<WebView | null>;

describe("switching tracks within the same playlist", () => {
  beforeAll(async () => {
    await setupPlayer();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (mockTrackPlayer.getPlaybackState as jest.Mock).mockResolvedValue({ state: "none" });
    (mockTrackPlayer.getProgress as jest.Mock).mockResolvedValue({ position: 0, duration: 0 });
    (mockTrackPlayer.getQueue as jest.Mock).mockResolvedValue([]);
  });

  const playFirstThenSecond = async () => {
    const { result } = renderHook(() => useAudioPlayerSync(webViewRef));

    await act(async () => {
      await result.current.playAudio({ resourceId: "file-1", tracks });
    });
    (mockTrackPlayer.reset as jest.Mock).mockClear();
    (mockTrackPlayer.add as jest.Mock).mockClear();
    (mockTrackPlayer.skip as jest.Mock).mockClear();

    await act(async () => {
      await result.current.playAudio({ resourceId: "file-2", tracks });
    });
  };

  it("skips using the native queue index when the track is in the queue", async () => {
    (mockTrackPlayer.getQueue as jest.Mock).mockResolvedValue([{ id: "file-1" }, { id: "file-2" }]);

    await playFirstThenSecond();

    expect(mockTrackPlayer.skip).toHaveBeenCalledWith(1);
    expect(mockTrackPlayer.reset).not.toHaveBeenCalled();
  });

  it("rebuilds the playlist instead of skipping when the native queue is empty", async () => {
    (mockTrackPlayer.getQueue as jest.Mock).mockResolvedValue([]);

    await playFirstThenSecond();

    expect(mockTrackPlayer.reset).toHaveBeenCalled();
    expect(mockTrackPlayer.add).toHaveBeenCalled();
    expect(mockTrackPlayer.skip).toHaveBeenCalledWith(1);
  });

  it("rebuilds the playlist when the native queue holds different tracks", async () => {
    (mockTrackPlayer.getQueue as jest.Mock).mockResolvedValue([{ id: "other-1" }, { id: "other-2" }]);

    await playFirstThenSecond();

    expect(mockTrackPlayer.reset).toHaveBeenCalled();
    expect(mockTrackPlayer.add).toHaveBeenCalled();
  });

  it("serializes concurrent playAudio calls so they cannot interleave", async () => {
    const callOrder: string[] = [];
    (mockTrackPlayer.reset as jest.Mock).mockImplementation(async () => {
      callOrder.push("reset");
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    (mockTrackPlayer.add as jest.Mock).mockImplementation(async () => {
      callOrder.push("add");
    });

    const { result } = renderHook(() => useAudioPlayerSync(webViewRef));

    await act(async () => {
      const first = result.current.playAudio({ resourceId: "file-1", tracks });
      const second = result.current.playAudio({
        resourceId: "file-1",
        tracks: [tracks[0]],
      });
      await Promise.all([first, second]);
    });

    // Each reset must be followed by its own add before the next reset starts.
    expect(callOrder).toEqual(["reset", "add", "reset", "add"]);
  });
});
