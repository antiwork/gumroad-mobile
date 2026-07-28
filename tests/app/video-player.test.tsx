import { AppState, Modal, StyleSheet } from "react-native";
import { renderWithQueryClient } from "../render-with-query-client";

type StatusChangePayload = { status: string; error?: { message: string } };
type TimeUpdatePayload = { currentTime: number };
let statusChangeListener: ((payload: StatusChangePayload) => void) | null = null;
let subtitleTrackChangeListener: ((payload: { subtitleTrack: unknown }) => void) | null = null;
let timeUpdateListener: ((payload: TimeUpdatePayload) => void) | null = null;
const mockSubscriptionRemove = jest.fn();
const mockLockAsync = jest.fn().mockResolvedValue(undefined);
const mockUnlockAsync = jest.fn().mockResolvedValue(undefined);
const mockFetchSubtitleText = jest.fn();

const mockPlayer = {
  loop: false,
  staysActiveInBackground: true,
  playing: true,
  currentTime: 0,
  timeUpdateEventInterval: 0,
  subtitleTrack: null as unknown,
  availableSubtitleTracks: [] as { language: string; label: string }[],
  play: jest.fn(),
  pause: jest.fn(),
  addListener: jest.fn((eventName: string, listener: (payload: never) => void) => {
    if (eventName === "statusChange") {
      statusChangeListener = listener as (payload: StatusChangePayload) => void;
    } else if (eventName === "subtitleTrackChange") {
      subtitleTrackChangeListener = listener as typeof subtitleTrackChangeListener;
    } else if (eventName === "timeUpdate") {
      timeUpdateListener = listener as (payload: TimeUpdatePayload) => void;
    }
    return { remove: mockSubscriptionRemove };
  }),
};

jest.mock("expo-video", () => {
  const { View } = require("react-native");
  return {
    useVideoPlayer: (_source: unknown, setup?: (player: typeof mockPlayer) => void) => {
      if (setup) setup(mockPlayer);
      return mockPlayer;
    },
    VideoView: (props: Record<string, unknown>) => <View testID="video-view" {...props} />,
  };
});

jest.mock("expo-screen-orientation", () => ({
  lockAsync: (...args: unknown[]) => mockLockAsync(...args),
  unlockAsync: (...args: unknown[]) => mockUnlockAsync(...args),
  OrientationLock: {
    PORTRAIT_UP: "portrait-up",
    LANDSCAPE: "landscape",
  },
}));

jest.mock("@/lib/subtitle-fetch", () => ({
  fetchSubtitleText: (...args: unknown[]) => mockFetchSubtitleText(...args),
}));

let mockSearchParams: Record<string, string> = { uri: "https://example.com/video.mp4", title: "Test Video" };

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockSearchParams,
  Stack: {
    Screen: ({ options }: { options?: { headerRight?: () => unknown } }) => options?.headerRight?.() ?? null,
  },
}));

const mockRequestAPI = jest.fn();

jest.mock("@/lib/request", () => ({
  ...jest.requireActual("@/lib/request"),
  requestAPI: (...args: unknown[]) => mockRequestAPI(...args),
}));

jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ accessToken: "test-token" }),
}));

jest.mock("@/lib/media-location", () => ({
  updateMediaLocation: jest.fn(),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 48, left: 24, right: 20 }),
}));

import VideoPlayerScreen from "@/app/video-player";
import * as Sentry from "@sentry/react-native";
import { fireEvent } from "@testing-library/react-native";
import { act } from "react";

let appStateCallback: ((state: string) => void) | null = null;
const mockRemove = jest.fn();

const renderScreen = () => renderWithQueryClient(<VideoPlayerScreen />);

describe("VideoPlayerScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPlayer.playing = true;
    mockPlayer.staysActiveInBackground = true;
    mockPlayer.loop = false;
    mockPlayer.currentTime = 0;
    mockPlayer.timeUpdateEventInterval = 0;
    mockPlayer.subtitleTrack = null;
    mockPlayer.availableSubtitleTracks = [];
    appStateCallback = null;
    statusChangeListener = null;
    subtitleTrackChangeListener = null;
    timeUpdateListener = null;
    mockSearchParams = { uri: "https://example.com/video.mp4", title: "Test Video" };
    mockRequestAPI.mockReset();
    mockLockAsync.mockResolvedValue(undefined);
    mockUnlockAsync.mockResolvedValue(undefined);
    mockFetchSubtitleText.mockReset();

    jest.spyOn(AppState, "addEventListener").mockImplementation((_type, callback) => {
      appStateCallback = callback as (state: string) => void;
      return { remove: mockRemove } as ReturnType<typeof AppState.addEventListener>;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("sets staysActiveInBackground to false on player setup", () => {
    renderScreen();
    expect(mockPlayer.staysActiveInBackground).toBe(false);
  });

  it("exposes when playback advances", () => {
    const { getByLabelText } = renderScreen();

    expect(getByLabelText("Video playback waiting")).toBeTruthy();

    act(() => {
      timeUpdateListener!({ currentTime: 0.25 });
    });

    expect(getByLabelText("Video playback started")).toBeTruthy();
  });

  it("pauses the player when app goes to background", () => {
    renderScreen();

    act(() => {
      appStateCallback!("background");
    });

    expect(mockPlayer.pause).toHaveBeenCalled();
  });

  it("resumes the player when app returns to active if it was playing", () => {
    renderScreen();
    mockPlayer.playing = true;

    act(() => {
      appStateCallback!("background");
    });

    act(() => {
      appStateCallback!("active");
    });

    expect(mockPlayer.play).toHaveBeenCalled();
  });

  it("does not resume the player when app returns to active if it was not playing", () => {
    renderScreen();
    mockPlayer.playing = false;

    act(() => {
      appStateCallback!("background");
    });

    mockPlayer.play.mockClear();

    act(() => {
      appStateCallback!("active");
    });

    expect(mockPlayer.play).not.toHaveBeenCalled();
  });

  it("pauses the player on unmount", () => {
    const { unmount } = renderScreen();
    mockPlayer.pause.mockClear();

    unmount();

    expect(mockPlayer.pause).toHaveBeenCalled();
  });

  it("does not crash on unmount when the player has already been released", () => {
    const { unmount } = renderScreen();
    mockPlayer.pause.mockImplementation(() => {
      throw Object.assign(new Error("Cannot use shared object that was already released"), {
        code: "ERR_USING_RELEASED_SHARED_OBJECT",
      });
    });

    expect(() => unmount()).not.toThrow();
  });

  it("does not crash on background when the player has already been released", () => {
    renderScreen();
    mockPlayer.pause.mockImplementation(() => {
      throw Object.assign(new Error("Cannot use shared object that was already released"), {
        code: "ERR_USING_RELEASED_SHARED_OBJECT",
      });
    });

    expect(() => act(() => appStateCallback!("background"))).not.toThrow();
  });

  it("does not crash on unmount when the player call fails with the iOS not-found exception", () => {
    const { unmount } = renderScreen();
    mockPlayer.pause.mockImplementation(() => {
      throw Object.assign(
        new Error(
          "Calling the 'pause' function has failed\n→ Caused by: Unable to find the native shared object associated with given JavaScript object",
        ),
        { code: "ERR_FUNCTION_CALL" },
      );
    });

    expect(() => unmount()).not.toThrow();
  });

  it("does not crash on background when the player call fails with the iOS not-found exception", () => {
    renderScreen();
    mockPlayer.pause.mockImplementation(() => {
      throw Object.assign(
        new Error(
          "Calling the 'pause' function has failed\n→ Caused by: Unable to find the native shared object associated with given JavaScript object",
        ),
        { code: "ERR_FUNCTION_CALL" },
      );
    });

    expect(() => act(() => appStateCallback!("background"))).not.toThrow();
  });

  it("restores the playback position when returning from background", () => {
    renderScreen();
    mockPlayer.currentTime = 120;
    mockPlayer.playing = true;

    act(() => {
      appStateCallback!("background");
    });

    mockPlayer.currentTime = 0;

    act(() => {
      appStateCallback!("active");
    });

    expect(mockPlayer.currentTime).toBe(120);
  });

  it("does not seek when the player has retained its position after returning from background", () => {
    renderScreen();
    mockPlayer.currentTime = 120;
    mockPlayer.playing = true;

    act(() => {
      appStateCallback!("background");
    });

    mockPlayer.currentTime = 119.5;

    act(() => {
      appStateCallback!("active");
    });

    expect(mockPlayer.currentTime).toBe(119.5);
  });

  it("renders an error message when the player reports an error status", () => {
    const { queryByText } = renderScreen();

    act(() => {
      statusChangeListener!({ status: "error", error: { message: "AVPlayer cannot decode the file" } });
    });

    expect(queryByText("This video failed to load")).toBeTruthy();
    expect(queryByText("AVPlayer cannot decode the file")).toBeTruthy();
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });

  it("clears the error state once the player becomes ready to play", () => {
    const { queryByText } = renderScreen();

    act(() => {
      statusChangeListener!({ status: "error", error: { message: "Transient network error" } });
    });
    expect(queryByText("This video failed to load")).toBeTruthy();

    act(() => {
      statusChangeListener!({ status: "readyToPlay" });
    });
    expect(queryByText("This video failed to load")).toBeNull();
  });

  it("pads the video container above the system navigation bar", async () => {
    const { getByTestId } = renderScreen();

    await act(async () => {});

    const container = getByTestId("video-player-container");
    const style = StyleSheet.flatten(container.props.style);
    expect(style.paddingBottom).toBe(48);
  });

  it("allows native fullscreen to use landscape and restores portrait on exit", async () => {
    const { getByTestId } = renderScreen();
    mockLockAsync.mockClear();

    await act(async () => {
      await getByTestId("video-player").props.onFullscreenEnter();
    });
    expect(mockLockAsync).toHaveBeenCalledWith("landscape");

    act(() => {
      getByTestId("video-player").props.onFullscreenExit();
    });
    expect(mockLockAsync).toHaveBeenCalledWith("portrait-up");
  });

  it("restores the app orientation when native fullscreen playback fails", async () => {
    const { getByTestId, getByText } = renderScreen();

    await act(async () => {
      await getByTestId("video-player").props.onFullscreenEnter();
    });
    mockLockAsync.mockClear();

    act(() => {
      statusChangeListener!({ status: "error", error: { message: "Playback failed" } });
    });

    expect(getByText("This video failed to load")).toBeTruthy();
    expect(mockLockAsync).toHaveBeenCalledWith("portrait-up");
  });

  it("clears a source-refresh transition when native fullscreen exits", async () => {
    mockSearchParams = {
      uri: "https://example.com/video.mp4",
      streamingUrl: "mobile/url_redirects/stream/token/file",
      title: "Test Video",
    };
    mockRequestAPI.mockResolvedValue({
      playlist_url: "https://example.com/index.m3u8",
      subtitles: [{ url: "https://example.com/captions.srt", language: "English" }],
    });
    mockFetchSubtitleText.mockResolvedValue(`1
00:00:00,000 --> 00:01:00,000
External caption text
`);
    const { getByTestId, getByText } = renderScreen();
    await act(async () => {});

    await act(async () => {
      await getByTestId("video-player").props.onFullscreenEnter();
    });

    mockSearchParams = {
      ...mockSearchParams,
      streamingUrl: "mobile/url_redirects/stream/replacement/file",
    };
    act(() => {
      statusChangeListener!({ status: "readyToPlay" });
    });
    await act(async () => {});

    act(() => {
      getByTestId("video-player").props.onFullscreenExit();
    });
    await act(async () => {
      fireEvent.press(getByTestId("captions-button"));
    });
    await act(async () => {
      fireEvent.press(getByText("English"));
    });

    expect(getByTestId("enter-fullscreen-button").props.accessibilityState).toEqual({ disabled: false });
  });

  describe("captions", () => {
    const SRT = `1
00:00:00,000 --> 00:01:00,000
External caption text
`;

    const renderWithExternalTrack = async () => {
      mockSearchParams = {
        uri: "https://example.com/video.mp4",
        streamingUrl: "mobile/url_redirects/stream/token/file",
        title: "Test Video",
      };
      mockRequestAPI.mockResolvedValue({
        playlist_url: "https://example.com/index.m3u8",
        subtitles: [{ url: "https://example.com/captions.srt", language: "English" }],
      });
      const utils = renderScreen();
      await act(async () => {});
      return utils;
    };

    beforeEach(() => {
      mockFetchSubtitleText.mockResolvedValue(SRT);
    });

    it("shows the captions button when the stream has external subtitle tracks", async () => {
      const { getByTestId } = await renderWithExternalTrack();
      expect(getByTestId("captions-button")).toBeTruthy();
    });

    it("does not show the captions button when there are no caption tracks", async () => {
      mockSearchParams = {
        uri: "https://example.com/video.mp4",
        streamingUrl: "mobile/url_redirects/stream/token/file",
        title: "Test Video",
      };
      mockRequestAPI.mockResolvedValue({ playlist_url: "https://example.com/index.m3u8", subtitles: [] });
      const { queryByTestId } = renderScreen();
      await act(async () => {});
      expect(queryByTestId("captions-button")).toBeNull();
      expect(queryByTestId("video-player")?.props.surfaceType).toBe("surfaceView");
    });

    it("fetches, parses, and renders an external subtitle track when selected", async () => {
      const { getByTestId, getByText } = await renderWithExternalTrack();

      await act(async () => {
        fireEvent.press(getByTestId("captions-button"));
      });
      await act(async () => {
        fireEvent.press(getByText("English"));
      });

      expect(mockFetchSubtitleText).toHaveBeenCalledWith("https://example.com/captions.srt", {
        signal: expect.any(AbortSignal),
      });
      expect(mockPlayer.subtitleTrack).toBeNull();
      expect(getByText("External caption text")).toBeTruthy();
    });

    it("disables the embedded track when an external track is selected", async () => {
      mockPlayer.subtitleTrack = { language: "en", label: "Embedded English" };
      const { getByTestId, getByText } = await renderWithExternalTrack();

      await act(async () => {
        fireEvent.press(getByTestId("captions-button"));
      });
      await act(async () => {
        fireEvent.press(getByText("English"));
      });

      expect(mockPlayer.subtitleTrack).toBeNull();
    });

    it("clears the external overlay when the native controls enable an embedded track", async () => {
      const { getByTestId, getByText, queryByTestId } = await renderWithExternalTrack();

      await act(async () => {
        fireEvent.press(getByTestId("captions-button"));
      });
      await act(async () => {
        fireEvent.press(getByText("English"));
      });
      expect(queryByTestId("subtitle-overlay")).toBeTruthy();

      act(() => {
        subtitleTrackChangeListener!({ subtitleTrack: { language: "en", label: "Embedded English" } });
      });

      expect(queryByTestId("subtitle-overlay")).toBeNull();
    });

    it("syncs the selector when the native controls turn embedded captions off", async () => {
      const embeddedTrack = { language: "en", label: "Embedded English" };
      mockPlayer.availableSubtitleTracks = [embeddedTrack];
      mockPlayer.subtitleTrack = embeddedTrack;
      const { getByTestId, getByRole } = renderScreen();

      await act(async () => {});
      act(() => {
        statusChangeListener!({ status: "readyToPlay" });
      });
      fireEvent.press(getByTestId("captions-button"));

      expect(getByRole("radio", { name: "Embedded English" }).props.accessibilityState).toEqual({ checked: true });

      act(() => {
        mockPlayer.subtitleTrack = null;
        subtitleTrackChangeListener!({ subtitleTrack: null });
      });

      expect(getByRole("radio", { name: "Off" }).props.accessibilityState).toEqual({ checked: true });
    });

    it("keeps external captions selected when disabling the embedded track emits a native event", async () => {
      const { getByLabelText, getByTestId, getByText, queryByTestId, UNSAFE_getAllByType } =
        await renderWithExternalTrack();

      await act(async () => {
        fireEvent.press(getByTestId("captions-button"));
      });
      await act(async () => {
        fireEvent.press(getByText("English"));
      });

      act(() => {
        subtitleTrackChangeListener!({ subtitleTrack: null });
      });

      expect(queryByTestId("subtitle-overlay")).toBeTruthy();
      expect(getByTestId("video-player").props.allowsPictureInPicture).toBe(false);
      expect(getByTestId("video-player").props.fullscreenOptions.enable).toBe(false);
      expect(getByTestId("video-player").props.surfaceType).toBe("textureView");

      mockLockAsync.mockClear();
      await act(async () => {
        fireEvent.press(getByLabelText("Enter fullscreen"));
      });
      expect(queryByTestId("video-player")).toBeNull();
      expect(getByTestId("fullscreen-video-player")).toBeTruthy();
      expect(queryByTestId("subtitle-overlay")).toBeTruthy();
      expect(mockLockAsync).toHaveBeenCalledWith("landscape");
      const dismissFullscreen = UNSAFE_getAllByType(Modal).find(
        (modal) => modal.props.testID === "external-caption-fullscreen",
      )?.props.onDismiss;
      expect(dismissFullscreen).toEqual(expect.any(Function));

      await act(async () => {
        fireEvent.press(getByLabelText("Exit fullscreen"));
      });
      expect(mockLockAsync).not.toHaveBeenCalledWith("portrait-up");
      act(() => dismissFullscreen?.());
      expect(getByTestId("video-player")).toBeTruthy();
      expect(queryByTestId("fullscreen-video-player")).toBeNull();
      expect(mockLockAsync).toHaveBeenCalledWith("portrait-up");
    });

    it("opens the caption picker inside external-caption fullscreen", async () => {
      const { getByLabelText, getByTestId, getByText, queryByTestId } = await renderWithExternalTrack();

      await act(async () => {
        fireEvent.press(getByTestId("captions-button"));
      });
      await act(async () => {
        fireEvent.press(getByText("English"));
      });
      await act(async () => {
        fireEvent.press(getByLabelText("Enter fullscreen"));
      });

      fireEvent.press(getByTestId("fullscreen-captions-button"));

      expect(getByTestId("fullscreen-video-player")).toBeTruthy();
      expect(getByTestId("fullscreen-caption-picker")).toBeTruthy();

      fireEvent.press(getByLabelText("Close captions"));

      expect(queryByTestId("fullscreen-caption-picker")).toBeNull();
      expect(getByTestId("fullscreen-video-player")).toBeTruthy();
    });

    it("does not mount the fullscreen modal until the landscape lock finishes", async () => {
      let resolveLock: () => void;
      mockLockAsync.mockReturnValueOnce(
        new Promise<void>((resolve) => {
          resolveLock = resolve;
        }),
      );
      const { getByLabelText, getByTestId, getByText, queryByTestId } = await renderWithExternalTrack();

      await act(async () => {
        fireEvent.press(getByTestId("captions-button"));
      });
      await act(async () => {
        fireEvent.press(getByText("English"));
      });
      act(() => {
        fireEvent.press(getByLabelText("Enter fullscreen"));
      });

      expect(queryByTestId("fullscreen-video-player")).toBeNull();

      await act(async () => {
        resolveLock!();
      });

      expect(getByTestId("fullscreen-video-player")).toBeTruthy();
    });

    it("serializes repeated external fullscreen requests", async () => {
      let resolveLock: () => void;
      mockLockAsync.mockReturnValueOnce(
        new Promise<void>((resolve) => {
          resolveLock = resolve;
        }),
      );
      const { getByLabelText, getByTestId, getByText } = await renderWithExternalTrack();

      await act(async () => {
        fireEvent.press(getByTestId("captions-button"));
      });
      await act(async () => {
        fireEvent.press(getByText("English"));
      });
      act(() => {
        fireEvent.press(getByLabelText("Enter fullscreen"));
        fireEvent.press(getByLabelText("Enter fullscreen"));
      });

      expect(mockLockAsync).toHaveBeenCalledTimes(1);
      expect(getByTestId("enter-fullscreen-button").props.accessibilityState).toEqual({ disabled: true });

      await act(async () => {
        resolveLock!();
      });

      expect(getByTestId("fullscreen-video-player")).toBeTruthy();
      expect(mockLockAsync).not.toHaveBeenCalledWith("portrait-up");
    });

    it("restores portrait when a pending fullscreen entry finishes after unmount", async () => {
      let resolveLock: () => void;
      mockLockAsync.mockReturnValueOnce(
        new Promise<void>((resolve) => {
          resolveLock = resolve;
        }),
      );
      const { getByLabelText, getByTestId, getByText, queryByTestId, unmount } = await renderWithExternalTrack();

      await act(async () => {
        fireEvent.press(getByTestId("captions-button"));
      });
      await act(async () => {
        fireEvent.press(getByText("English"));
      });
      act(() => {
        fireEvent.press(getByLabelText("Enter fullscreen"));
      });
      expect(queryByTestId("fullscreen-video-player")).toBeNull();

      unmount();
      await act(async () => {
        resolveLock!();
      });

      expect(mockLockAsync).toHaveBeenCalledWith("portrait-up");
    });

    it("keeps the modal mounted through a source refresh so iOS can restore portrait on dismissal", async () => {
      let resolveStream: (value: { playlist_url: string; subtitles: never[] }) => void;
      const { getByLabelText, getByTestId, getByText, queryByTestId, UNSAFE_getAllByType } =
        await renderWithExternalTrack();

      await act(async () => {
        fireEvent.press(getByTestId("captions-button"));
      });
      await act(async () => {
        fireEvent.press(getByText("English"));
      });
      await act(async () => {
        fireEvent.press(getByLabelText("Enter fullscreen"));
      });

      mockSearchParams = {
        ...mockSearchParams,
        streamingUrl: "mobile/url_redirects/stream/replacement/file",
      };
      mockRequestAPI.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveStream = resolve;
        }),
      );
      mockLockAsync.mockClear();
      act(() => {
        statusChangeListener!({ status: "readyToPlay" });
      });

      expect(queryByTestId("fullscreen-video-player")).toBeNull();
      const dismissFullscreen = UNSAFE_getAllByType(Modal).find(
        (modal) => modal.props.testID === "external-caption-fullscreen",
      )?.props.onDismiss;
      expect(dismissFullscreen).toEqual(expect.any(Function));

      act(() => dismissFullscreen?.());
      expect(mockLockAsync).toHaveBeenCalledWith("portrait-up");

      await act(async () => {
        resolveStream!({
          playlist_url: "https://example.com/replacement.m3u8",
          subtitles: [],
        });
      });
    });

    it("exits external-caption fullscreen and restores portrait when playback fails", async () => {
      const { getByLabelText, getByTestId, getByText, queryByTestId, UNSAFE_getAllByType } =
        await renderWithExternalTrack();

      await act(async () => {
        fireEvent.press(getByTestId("captions-button"));
      });
      await act(async () => {
        fireEvent.press(getByText("English"));
      });
      await act(async () => {
        fireEvent.press(getByLabelText("Enter fullscreen"));
      });
      mockLockAsync.mockClear();

      await act(async () => {
        statusChangeListener!({ status: "error", error: { message: "Playback failed" } });
      });
      const dismissFullscreen = UNSAFE_getAllByType(Modal).find(
        (modal) => modal.props.testID === "external-caption-fullscreen",
      )?.props.onDismiss;
      expect(dismissFullscreen).toEqual(expect.any(Function));
      act(() => dismissFullscreen?.());

      expect(queryByTestId("fullscreen-video-player")).toBeNull();
      expect(getByText("This video failed to load")).toBeTruthy();
      expect(mockLockAsync).toHaveBeenCalledWith("portrait-up");
    });

    it("keeps fullscreen controls and captions inside landscape safe areas", async () => {
      const { getByLabelText, getByTestId, getByText } = await renderWithExternalTrack();

      await act(async () => {
        fireEvent.press(getByTestId("captions-button"));
      });
      await act(async () => {
        fireEvent.press(getByText("English"));
      });
      await act(async () => {
        fireEvent.press(getByLabelText("Enter fullscreen"));
      });

      expect(StyleSheet.flatten(getByTestId("fullscreen-header").props.style)).toMatchObject({
        left: 36,
        right: 32,
        top: 12,
      });
      expect(StyleSheet.flatten(getByTestId("subtitle-overlay").props.style)).toMatchObject({
        left: 40,
        right: 36,
        bottom: 144,
      });
    });

    it("updates the overlay text as playback progresses", async () => {
      const { getByTestId, getByText, queryByTestId } = await renderWithExternalTrack();

      await act(async () => {
        fireEvent.press(getByTestId("captions-button"));
      });
      await act(async () => {
        fireEvent.press(getByText("English"));
      });

      act(() => {
        timeUpdateListener!({ currentTime: 30 });
      });
      expect(queryByTestId("subtitle-overlay")).toBeTruthy();

      act(() => {
        timeUpdateListener!({ currentTime: 90 });
      });
      expect(queryByTestId("subtitle-overlay")).toBeNull();
    });

    it("turns captions off when fetching the external track fails", async () => {
      mockFetchSubtitleText.mockRejectedValue(new Error("network down"));
      const { getByTestId, getByText, queryByTestId } = await renderWithExternalTrack();

      await act(async () => {
        fireEvent.press(getByTestId("captions-button"));
      });
      await act(async () => {
        fireEvent.press(getByText("English"));
      });

      expect(queryByTestId("subtitle-overlay")).toBeNull();
      expect(Sentry.captureException).toHaveBeenCalled();
    });

    it("turns captions off when an external track has no valid cues", async () => {
      mockFetchSubtitleText.mockResolvedValue("not a subtitle file");
      const { getByRole, getByTestId, getByText } = await renderWithExternalTrack();

      await act(async () => {
        fireEvent.press(getByTestId("captions-button"));
      });
      await act(async () => {
        fireEvent.press(getByText("English"));
      });
      fireEvent.press(getByTestId("captions-button"));

      expect(getByRole("radio", { name: "Off" }).props.accessibilityState).toEqual({ checked: true });
      expect(getByTestId("video-player").props.allowsPictureInPicture).toBe(true);
      expect(Sentry.captureException).toHaveBeenCalled();
    });

    it("does not cache a failed subtitle download", async () => {
      mockFetchSubtitleText.mockRejectedValue(new Error("Subtitle fetch failed with status 403"));
      const { getByTestId, getByText, queryByTestId } = await renderWithExternalTrack();

      await act(async () => {
        fireEvent.press(getByTestId("captions-button"));
      });
      await act(async () => {
        fireEvent.press(getByText("English"));
      });

      expect(queryByTestId("subtitle-overlay")).toBeNull();
      expect(Sentry.captureException).toHaveBeenCalled();

      await act(async () => {
        fireEvent.press(getByTestId("captions-button"));
      });
      await act(async () => {
        fireEvent.press(getByText("English"));
      });

      expect(mockFetchSubtitleText).toHaveBeenCalledTimes(2);
    });

    it("ignores a stale subtitle fetch when the buyer selects Off before it resolves", async () => {
      let resolveFetch: (value: string) => void;
      mockFetchSubtitleText.mockReturnValue(
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
      );
      const { getByTestId, getByText, queryByTestId, queryByText } = await renderWithExternalTrack();

      await act(async () => {
        fireEvent.press(getByTestId("captions-button"));
      });
      await act(async () => {
        fireEvent.press(getByText("English"));
      });

      await act(async () => {
        fireEvent.press(getByTestId("captions-button"));
      });
      await act(async () => {
        fireEvent.press(getByText("Off"));
      });

      expect(mockFetchSubtitleText.mock.calls[0]?.[1].signal.aborted).toBe(true);

      await act(async () => {
        resolveFetch!(SRT);
      });

      expect(queryByTestId("subtitle-overlay")).toBeNull();
      expect(queryByText("External caption text")).toBeNull();
    });

    it("clears the previous track's captions while a newly selected external track is still loading", async () => {
      const firstSrt = SRT;
      const secondSrt = `1
00:00:00,000 --> 00:01:00,000
Second track caption text
`;
      let resolveSecondFetch: (value: string) => void;
      mockFetchSubtitleText.mockResolvedValueOnce(firstSrt).mockReturnValueOnce(
        new Promise((resolve) => {
          resolveSecondFetch = resolve;
        }),
      );
      mockSearchParams = {
        uri: "https://example.com/video.mp4",
        streamingUrl: "mobile/url_redirects/stream/token/file",
        title: "Test Video",
      };
      mockRequestAPI.mockResolvedValue({
        playlist_url: "https://example.com/index.m3u8",
        subtitles: [
          { url: "https://example.com/captions-en.srt", language: "English" },
          { url: "https://example.com/captions-fr.srt", language: "French" },
        ],
      });
      const { getByTestId, getByText, queryByText } = renderScreen();
      await act(async () => {});

      await act(async () => {
        fireEvent.press(getByTestId("captions-button"));
      });
      await act(async () => {
        fireEvent.press(getByText("English"));
      });
      expect(getByText("External caption text")).toBeTruthy();

      await act(async () => {
        fireEvent.press(getByTestId("captions-button"));
      });
      await act(async () => {
        fireEvent.press(getByText("French"));
      });

      expect(queryByText("External caption text")).toBeNull();

      await act(async () => {
        resolveSecondFetch!(secondSrt);
      });
      expect(getByText("Second track caption text")).toBeTruthy();
    });

    it("ignores a stale subtitle fetch when the native controls enable an embedded track before it resolves", async () => {
      let resolveFetch: (value: string) => void;
      mockFetchSubtitleText.mockReturnValue(
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
      );
      const { getByTestId, getByText, queryByTestId } = await renderWithExternalTrack();

      await act(async () => {
        fireEvent.press(getByTestId("captions-button"));
      });
      await act(async () => {
        fireEvent.press(getByText("English"));
      });

      act(() => {
        subtitleTrackChangeListener!({ subtitleTrack: { language: "en", label: "Embedded English" } });
      });

      expect(mockFetchSubtitleText.mock.calls[0]?.[1].signal.aborted).toBe(true);

      await act(async () => {
        resolveFetch!(SRT);
      });

      expect(queryByTestId("subtitle-overlay")).toBeNull();
    });
  });
});
