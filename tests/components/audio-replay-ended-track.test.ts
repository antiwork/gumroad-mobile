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
