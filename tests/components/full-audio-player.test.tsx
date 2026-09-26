import { FullAudioPlayer } from "@/components/full-audio-player";
import { act, fireEvent, render } from "@testing-library/react-native";
import { AccessibilityInfo, View } from "react-native";
import TrackPlayer from "react-native-track-player";

let mockProgress = { position: 12, duration: 120 };
jest.mock("@/components/styled", () => ({ StyledImage: jest.requireActual("react-native").Image }));

jest.mock("react-native-track-player", () => ({
  __esModule: true,
  default: {
    getQueue: jest.fn().mockResolvedValue([]),
    getActiveTrackIndex: jest.fn().mockResolvedValue(0),
    getRate: jest.fn().mockResolvedValue(1),
    pause: jest.fn(),
    play: jest.fn(),
  },
  State: { Playing: "playing" },
  RepeatMode: { Queue: "queue", Off: "off" },
  usePlaybackState: () => ({ state: "playing" }),
  useActiveTrack: () => ({ url: "https://example.com/audio.mp3", title: "Test audio" }),
  useProgress: () => mockProgress,
}));

jest.mock("react-native-gesture-handler", () => {
  const gesture = {
    hitSlop: jest.fn().mockReturnThis(),
    onBegin: jest.fn().mockReturnThis(),
    onUpdate: jest.fn().mockReturnThis(),
    onFinalize: jest.fn().mockReturnThis(),
    onEnd: jest.fn().mockReturnThis(),
  };
  return {
    Gesture: { Pan: () => gesture, Tap: () => gesture, Exclusive: jest.fn() },
    GestureDetector: ({ children }: { children: React.ReactNode }) => children,
  };
});

let screenReaderListener: (enabled: boolean) => void;
const removeSubscription = jest.fn();
const player = <FullAudioPlayer visible onClose={jest.fn()} />;

beforeEach(() => {
  jest.clearAllMocks();
  mockProgress = { position: 12, duration: 120 };
  jest.spyOn(AccessibilityInfo, "isScreenReaderEnabled").mockResolvedValue(false);
  jest.spyOn(AccessibilityInfo, "addEventListener").mockImplementation(((
    event: string,
    listener: (enabled: boolean) => void,
  ) => {
    expect(event).toBe("screenReaderChanged");
    screenReaderListener = listener;
    return { remove: removeSubscription };
  }) as unknown as typeof AccessibilityInfo.addEventListener);
});

afterEach(() => jest.restoreAllMocks());

describe("FullAudioPlayer screen reader progress", () => {
  it("omits the accessibility value across ticks while keeping the role, label, and visual bar", async () => {
    const { getByLabelText, getByText, rerender } = render(player);
    await act(async () => {});
    for (const position of [12, 24, 36]) {
      mockProgress = { position, duration: 120 };
      rerender(<FullAudioPlayer visible onClose={jest.fn()} />);
      const bar = getByLabelText("Playback position");
      expect(bar.props.accessibilityRole).toBe("progressbar");
      expect(bar.props.accessibilityValue).toBeUndefined();
      expect(
        bar
          .findAllByType(View)
          .some(
            (view: { props: { style?: { width?: string } } }) =>
              view.props.style?.width === `${(position / 120) * 100}%`,
          ),
      ).toBe(true);
      expect(getByText(`0:${position}`)).toBeTruthy();
    }
    fireEvent.press(getByLabelText("Pause"));
    expect(TrackPlayer.pause).toHaveBeenCalledTimes(1);
  });

  it("publishes advancing text when the reader is initially on", async () => {
    jest.mocked(AccessibilityInfo.isScreenReaderEnabled).mockResolvedValue(true);
    const { getByLabelText, rerender } = render(player);
    await act(async () => {});
    expect(getByLabelText("Playback position").props.accessibilityValue).toEqual({ text: "0:12 of 2:00" });
    mockProgress = { position: 24, duration: 120 };
    rerender(<FullAudioPlayer visible onClose={jest.fn()} />);
    expect(getByLabelText("Playback position").props.accessibilityValue).toEqual({ text: "0:24 of 2:00" });
  });

  it("starts and stops publishing when the reader changes during playback", async () => {
    const { getByLabelText, rerender } = render(player);
    await act(async () => {});
    act(() => screenReaderListener(true));
    expect(getByLabelText("Playback position").props.accessibilityValue).toEqual({ text: "0:12 of 2:00" });
    act(() => screenReaderListener(false));
    mockProgress = { position: 24, duration: 120 };
    rerender(<FullAudioPlayer visible onClose={jest.fn()} />);
    expect(getByLabelText("Playback position").props.accessibilityValue).toBeUndefined();
  });

  it("ignores an initial result older than a reader change", async () => {
    let resolveInitial!: (enabled: boolean) => void;
    jest.mocked(AccessibilityInfo.isScreenReaderEnabled).mockReturnValue(
      new Promise((resolve) => {
        resolveInitial = resolve;
      }),
    );
    const { getByLabelText } = render(player);
    act(() => screenReaderListener(true));
    await act(async () => resolveInitial(false));
    expect(getByLabelText("Playback position").props.accessibilityValue).toEqual({ text: "0:12 of 2:00" });
  });

  it("keeps publishing after an initial query failure", async () => {
    jest.mocked(AccessibilityInfo.isScreenReaderEnabled).mockRejectedValue(new Error("unavailable"));
    const { getByLabelText } = render(player);
    await act(async () => {});
    expect(getByLabelText("Playback position").props.accessibilityValue).toEqual({ text: "0:12 of 2:00" });
    act(() => screenReaderListener(true));
    expect(getByLabelText("Playback position").props.accessibilityValue).toEqual({ text: "0:12 of 2:00" });
  });

  it("removes the reader subscription and tolerates a late initial result on unmount", async () => {
    let resolveInitial!: (enabled: boolean) => void;
    jest.mocked(AccessibilityInfo.isScreenReaderEnabled).mockReturnValue(
      new Promise((resolve) => {
        resolveInitial = resolve;
      }),
    );
    const { unmount } = render(player);
    await act(async () => {});
    unmount();
    expect(removeSubscription).toHaveBeenCalledTimes(1);
    await act(async () => resolveInitial(true));
  });
});
