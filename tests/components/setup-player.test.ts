jest.mock("react-native-track-player", () => ({
  __esModule: true,
  default: {
    setupPlayer: jest.fn().mockResolvedValue(undefined),
    updateOptions: jest.fn().mockResolvedValue(undefined),
    setRepeatMode: jest.fn().mockResolvedValue(undefined),
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
  Event: {},
  RepeatMode: { Off: "off", Queue: "queue" },
  State: {},
}));

jest.mock("../../components/full-audio-player", () => ({
  getStoredLoopEnabled: jest.fn().mockResolvedValue(false),
  getStoredPlaybackSpeed: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/audio-player-store", () => ({
  setAudioAccessToken: jest.fn(),
  setAudioContext: jest.fn(),
}));

jest.mock("@/lib/auth-context", () => ({ useAuth: jest.fn() }));
jest.mock("@/lib/media-location", () => ({ updateMediaLocation: jest.fn() }));

/* eslint-disable import/first -- jest.mock calls must precede the imports they affect */
import TrackPlayer from "react-native-track-player";
import { setupPlayer } from "../../components/use-audio-player-sync";

const mockTrackPlayer = TrackPlayer as jest.Mocked<typeof TrackPlayer>;

describe("setupPlayer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("disables Android audio offload so playback-speed changes preserve pitch", async () => {
    await setupPlayer();

    expect(mockTrackPlayer.updateOptions).toHaveBeenCalledTimes(1);
    const options = (mockTrackPlayer.updateOptions as jest.Mock).mock.calls[0][0];
    expect(options.android).toBeDefined();
    expect(options.android.audioOffload).toBe(false);
  });
});

describe("setupPlayer when the native player already exists", () => {
  // setupPlayer remembers success in module state, so each test needs a fresh module copy.
  const freshSetupPlayer = () => {
    let fresh: typeof setupPlayer = setupPlayer;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      fresh = (require("../../components/use-audio-player-sync") as { setupPlayer: typeof setupPlayer }).setupPlayer;
    });
    return fresh;
  };

  it("continues with configuration instead of failing when the playback service survived an app restart", async () => {
    const alreadyInitialized = Object.assign(new Error("The player has already been initialized via setupPlayer."), {
      code: "player_already_initialized",
    });
    (mockTrackPlayer.setupPlayer as jest.Mock).mockRejectedValueOnce(alreadyInitialized);

    await expect(freshSetupPlayer()()).resolves.toBeUndefined();

    expect(mockTrackPlayer.updateOptions).toHaveBeenCalled();
  });

  it("still surfaces other setup failures", async () => {
    (mockTrackPlayer.setupPlayer as jest.Mock).mockRejectedValueOnce(new Error("something else broke"));

    await expect(freshSetupPlayer()()).rejects.toThrow("something else broke");
  });
});
