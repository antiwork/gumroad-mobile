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
