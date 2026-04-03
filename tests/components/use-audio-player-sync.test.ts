// Capture the options passed to setupPlayer
let capturedSetupOptions: Record<string, unknown> | undefined;

const mockSetupPlayer = jest.fn(async (options?: Record<string, unknown>) => {
  capturedSetupOptions = options;
});

jest.mock("react-native-track-player", () => ({
  __esModule: true,
  default: {
    setupPlayer: mockSetupPlayer,
    updateOptions: jest.fn(async () => {}),
    setRepeatMode: jest.fn(async () => {}),
    getRate: jest.fn(async () => 1),
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    getPlaybackState: jest.fn(async () => ({ state: "none" })),
    getProgress: jest.fn(async () => ({ position: 0, duration: 0, buffered: 0 })),
    getQueue: jest.fn(async () => []),
    getActiveTrackIndex: jest.fn(async () => 0),
    play: jest.fn(async () => {}),
    pause: jest.fn(async () => {}),
    reset: jest.fn(async () => {}),
  },
  IOSCategory: { Playback: "playback", SoloAmbient: "soloAmbient", Ambient: "ambient" },
  IOSCategoryMode: { Default: "default", SpokenAudio: "spokenAudio" },
  IOSCategoryOptions: {},
  Capability: {
    Play: "play",
    Pause: "pause",
    Stop: "stop",
    SkipToNext: "skipToNext",
    SkipToPrevious: "skipToPrevious",
    JumpForward: "jumpForward",
    JumpBackward: "jumpBackward",
  },
  Event: {
    PlaybackState: "playback-state",
    PlaybackQueueEnded: "playback-queue-ended",
    PlaybackActiveTrackChanged: "playback-active-track-changed",
    RemotePlay: "remote-play",
    RemotePause: "remote-pause",
    RemoteStop: "remote-stop",
    RemoteNext: "remote-next",
    RemotePrevious: "remote-previous",
    RemoteJumpForward: "remote-jump-forward",
    RemoteJumpBackward: "remote-jump-backward",
  },
  RepeatMode: { Off: 0, Track: 1, Queue: 2 },
  State: { None: "none", Playing: "playing", Paused: "paused", Stopped: "stopped", Buffering: "buffering", Loading: "loading", Ended: "ended" },
  useActiveTrack: jest.fn(() => null),
  usePlaybackState: jest.fn(() => ({ state: "none" })),
  useProgress: jest.fn(() => ({ position: 0, duration: 0, buffered: 0 })),
}));

jest.mock("react-native-webview", () => ({
  __esModule: true,
  default: "WebView",
  WebView: "WebView",
}));

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
}));

jest.mock("expo-image", () => ({
  Image: "Image",
}));

describe("setupPlayer", () => {
  beforeEach(() => {
    capturedSetupOptions = undefined;
  });

  it("configures iOS audio session category to Playback for background audio", async () => {
    const { setupPlayer } = require("../../components/use-audio-player-sync");
    await setupPlayer();

    expect(mockSetupPlayer).toHaveBeenCalledWith(
      expect.objectContaining({
        iosCategory: "playback",
        autoHandleInterruptions: true,
      }),
    );
  });

  it("does not use SoloAmbient or Ambient category (which pause on screen lock)", async () => {
    const { setupPlayer } = require("../../components/use-audio-player-sync");
    await setupPlayer();

    expect(capturedSetupOptions?.iosCategory).not.toBe("soloAmbient");
    expect(capturedSetupOptions?.iosCategory).not.toBe("ambient");
  });
});
