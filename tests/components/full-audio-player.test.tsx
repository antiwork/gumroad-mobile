import { RepeatMode } from "react-native-track-player";

jest.mock("react-native-webview", () => ({ WebView: "WebView" }));

const mockGetItemAsync = jest.fn();
const mockSetItemAsync = jest.fn();
jest.mock("expo-secure-store", () => ({
  getItemAsync: (...args: unknown[]) => mockGetItemAsync(...args),
  setItemAsync: (...args: unknown[]) => mockSetItemAsync(...args),
}));

const mockSetRepeatMode = jest.fn();
const mockGetRepeatMode = jest.fn().mockResolvedValue(RepeatMode.Queue);
const mockGetRate = jest.fn().mockResolvedValue(1);
const mockGetQueue = jest.fn().mockResolvedValue([{ id: "1", url: "test.mp3", title: "Track 1" }]);
const mockGetActiveTrackIndex = jest.fn().mockResolvedValue(0);

jest.mock("react-native-track-player", () => {
  const RepeatMode = { Off: 0, Track: 1, Queue: 2 };
  const State = { Playing: "playing", Paused: "paused" };
  return {
    __esModule: true,
    default: {
      setRepeatMode: (...args: unknown[]) => mockSetRepeatMode(...args),
      getRepeatMode: () => mockGetRepeatMode(),
      getRate: () => mockGetRate(),
      getQueue: () => mockGetQueue(),
      getActiveTrackIndex: () => mockGetActiveTrackIndex(),
      getProgress: jest.fn().mockResolvedValue({ position: 0, duration: 100 }),
      pause: jest.fn(),
      play: jest.fn(),
    },
    RepeatMode,
    State,
    useActiveTrack: () => ({ id: "1", url: "test.mp3", title: "Track 1", artist: "Test" }),
    usePlaybackState: () => ({ state: State.Playing }),
    useProgress: () => ({ position: 30, duration: 100 }),
  };
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { FullAudioPlayer, getStoredRepeatMode } from "@/components/full-audio-player";

describe("FullAudioPlayer repeat mode", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetRepeatMode.mockResolvedValue(RepeatMode.Queue);
  });

  describe("getStoredRepeatMode", () => {
    it("returns Queue as default when no stored value", async () => {
      mockGetItemAsync.mockResolvedValue(null);
      const mode = await getStoredRepeatMode();
      expect(mode).toBe(RepeatMode.Queue);
    });

    it("returns stored repeat mode when valid", async () => {
      mockGetItemAsync.mockResolvedValue(RepeatMode.Track.toString());
      const mode = await getStoredRepeatMode();
      expect(mode).toBe(RepeatMode.Track);
    });

    it("returns Queue for invalid stored value", async () => {
      mockGetItemAsync.mockResolvedValue("99");
      const mode = await getStoredRepeatMode();
      expect(mode).toBe(RepeatMode.Queue);
    });
  });

  describe("repeat mode cycling", () => {
    it("renders repeat button", async () => {
      render(<FullAudioPlayer visible onClose={jest.fn()} />);
      await waitFor(() => {
        expect(screen.getByTestId("repeat-button")).toBeTruthy();
      });
    });

    it("cycles through Off → Queue → Track → Off", async () => {
      mockGetRepeatMode.mockResolvedValue(RepeatMode.Off);
      render(<FullAudioPlayer visible onClose={jest.fn()} />);

      const button = await waitFor(() => screen.getByTestId("repeat-button"));

      fireEvent.press(button);
      await waitFor(() => {
        expect(mockSetRepeatMode).toHaveBeenCalledWith(RepeatMode.Queue);
      });

      mockGetRepeatMode.mockResolvedValue(RepeatMode.Queue);
      fireEvent.press(button);
      await waitFor(() => {
        expect(mockSetRepeatMode).toHaveBeenCalledWith(RepeatMode.Track);
      });

      mockGetRepeatMode.mockResolvedValue(RepeatMode.Track);
      fireEvent.press(button);
      await waitFor(() => {
        expect(mockSetRepeatMode).toHaveBeenCalledWith(RepeatMode.Off);
      });
    });

    it("persists repeat mode to SecureStore", async () => {
      mockGetRepeatMode.mockResolvedValue(RepeatMode.Off);
      render(<FullAudioPlayer visible onClose={jest.fn()} />);

      const button = await waitFor(() => screen.getByTestId("repeat-button"));
      fireEvent.press(button);

      await waitFor(() => {
        expect(mockSetItemAsync).toHaveBeenCalledWith("audio_repeat_mode", RepeatMode.Queue.toString());
      });
    });
  });
});
