import { AppState, Modal, Platform, StatusBar, StyleSheet } from "react-native";
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
const mockUpdateMediaLocation = jest.fn();
const mockSetNavigationBarVisibilityAsync = jest.fn().mockResolvedValue(undefined);
let mockSetAccessToken: ((token: string) => void) | null = null;

jest.mock("expo-navigation-bar", () => ({
  setVisibilityAsync: (...args: unknown[]) => mockSetNavigationBarVisibilityAsync(...args),
}));

const mockPlayer = {
  loop: false,
  staysActiveInBackground: true,
  playing: true,
  currentTime: 0,
  duration: 0,
  timeUpdateEventInterval: 0,
  allowsExternalPlayback: true,
  subtitleTrack: null as unknown,
  availableSubtitleTracks: [] as { language: string; label: string }[],
  play: jest.fn(),
  pause: jest.fn(),
  replace: jest.fn(),
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

jest.mock("@/lib/subtitle-fetch", () => {
  class SubtitleFetchError extends Error {
    readonly status: number;

    constructor(mockStatus: number) {
      super(`Subtitle fetch failed with status ${mockStatus}`);
      this.name = "SubtitleFetchError";
      this.status = mockStatus;
    }
  }
  return {
    fetchSubtitleText: (...args: unknown[]) => mockFetchSubtitleText(...args),
    SubtitleFetchError,
  };
});

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
  useAuth: () => {
    const [accessToken, setAccessToken] = jest.requireActual("react").useState("test-token");
    mockSetAccessToken = setAccessToken;
    return { accessToken };
  },
}));

jest.mock("@/lib/media-location", () => ({
  ...jest.requireActual("@/lib/media-location"),
  updateMediaLocation: (...args: unknown[]) => mockUpdateMediaLocation(...args),
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
    mockPlayer.duration = 0;
    mockPlayer.timeUpdateEventInterval = 0;
    mockPlayer.allowsExternalPlayback = true;
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
    mockSetNavigationBarVisibilityAsync.mockResolvedValue(undefined);
    mockSetAccessToken = null;

    jest.spyOn(AppState, "addEventListener").mockImplementation((_type, callback) => {
      appStateCallback = callback as (state: string) => void;
      return { remove: mockRemove } as ReturnType<typeof AppState.addEventListener>;
    });
    jest.spyOn(StatusBar, "setHidden").mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("sets staysActiveInBackground to false on player setup on Android", () => {
    const originalPlatform = Platform.OS;
    Object.defineProperty(Platform, "OS", { configurable: true, value: "android" });
    try {
      renderScreen();
      expect(mockPlayer.staysActiveInBackground).toBe(false);
    } finally {
      Object.defineProperty(Platform, "OS", { configurable: true, value: originalPlatform });
    }
  });

  it("exposes when playback advances", () => {
    const { getByLabelText } = renderScreen();

    expect(getByLabelText("Video playback waiting")).toBeTruthy();

    act(() => {
      timeUpdateListener!({ currentTime: 0.25 });
    });

    expect(getByLabelText("Video playback started")).toBeTruthy();
  });

  describe("resuming from a saved position", () => {
    it("starts the player at the saved position", () => {
      mockSearchParams = { uri: "https://example.com/video.mp4", initialPosition: "1209" };

      renderScreen();

      expect(mockPlayer.currentTime).toBe(1209);
      expect(mockPlayer.play).toHaveBeenCalled();
    });

    it("restarts a finished video from the beginning when content_length says it is at the end", () => {
      mockSearchParams = { uri: "https://example.com/video.mp4", initialPosition: "600", contentLength: "600" };

      renderScreen();

      expect(mockPlayer.currentTime).toBe(0);
    });

    it("restarts a finished video from the beginning once the loaded duration reveals it is at the end", () => {
      mockSearchParams = { uri: "https://example.com/video.mp4", initialPosition: "600" };
      renderScreen();
      expect(mockPlayer.currentTime).toBe(600);

      mockPlayer.duration = 600;
      act(() => {
        statusChangeListener!({ status: "readyToPlay" });
      });

      expect(mockPlayer.currentTime).toBe(0);
    });

    it("keeps a resumable position when the loaded duration is longer than it", () => {
      mockSearchParams = { uri: "https://example.com/video.mp4", initialPosition: "600" };
      renderScreen();

      mockPlayer.duration = 1800;
      act(() => {
        statusChangeListener!({ status: "readyToPlay" });
      });

      expect(mockPlayer.currentTime).toBe(600);
    });

    it("does not snap a rewatching buyer back to the start when readyToPlay fires again", () => {
      mockSearchParams = { uri: "https://example.com/video.mp4", initialPosition: "600", contentLength: "600" };
      renderScreen();
      act(() => {
        statusChangeListener!({ status: "readyToPlay" });
      });
      expect(mockPlayer.currentTime).toBe(0);

      // A seek or a rebuffer cycles the player back through readyToPlay.
      mockPlayer.currentTime = 240;
      mockPlayer.duration = 600;
      act(() => {
        statusChangeListener!({ status: "readyToPlay" });
      });

      expect(mockPlayer.currentTime).toBe(240);
    });

    it("reports playback as started after a finished video restarts from the beginning", () => {
      mockSearchParams = { uri: "https://example.com/video.mp4", initialPosition: "600", contentLength: "600" };
      const { getByLabelText } = renderScreen();

      act(() => {
        timeUpdateListener!({ currentTime: 0.25 });
      });

      expect(getByLabelText("Video playback started")).toBeTruthy();
    });

    it("keeps the seeded duration when the player reports no duration yet", () => {
      mockSearchParams = { uri: "https://example.com/video.mp4", initialPosition: "600", contentLength: "1800" };
      const { getByTestId } = renderScreen();

      mockPlayer.duration = 0;
      act(() => {
        statusChangeListener!({ status: "readyToPlay" });
      });

      expect(getByTestId("video-player").props.accessibilityValue).toEqual({ text: "10:00 of 30:00" });
    });

    it("reports playback as started relative to the resumed position", () => {
      mockSearchParams = { uri: "https://example.com/video.mp4", initialPosition: "1209" };
      const { getByLabelText } = renderScreen();

      act(() => {
        timeUpdateListener!({ currentTime: 1209 });
      });
      expect(getByLabelText("Video playback waiting")).toBeTruthy();

      act(() => {
        timeUpdateListener!({ currentTime: 1209.5 });
      });
      expect(getByLabelText("Video playback started")).toBeTruthy();
    });

    it("exposes the resumed position so end-to-end flows can assert playback did not restart", () => {
      mockSearchParams = { uri: "https://example.com/video.mp4", initialPosition: "1209", contentLength: "1800" };
      const { getByTestId } = renderScreen();

      expect(getByTestId("video-player").props.accessibilityValue).toEqual({ text: "20:09 of 30:00" });
    });
  });

  describe("saving progress", () => {
    const trackedParams = {
      uri: "https://example.com/video.mp4",
      urlRedirectId: "redirect-1",
      productFileId: "file-1",
      purchaseId: "purchase-1",
    };

    beforeEach(() => {
      jest.useFakeTimers();
      mockUpdateMediaLocation.mockResolvedValue(undefined);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("does not save a position at the very start over a saved one", () => {
      mockSearchParams = trackedParams;
      renderScreen();
      mockPlayer.currentTime = 0;

      act(() => {
        jest.advanceTimersByTime(5000);
      });

      expect(mockUpdateMediaLocation).not.toHaveBeenCalled();
    });

    it("saves a position past the start", () => {
      mockSearchParams = trackedParams;
      renderScreen();
      mockPlayer.currentTime = 42;

      act(() => {
        jest.advanceTimersByTime(5000);
      });

      expect(mockUpdateMediaLocation).toHaveBeenCalledWith(
        expect.objectContaining({
          urlRedirectId: "redirect-1",
          productFileId: "file-1",
          purchaseId: "purchase-1",
          location: 42,
        }),
      );
    });

    it("saves the full duration once playback reaches the end", () => {
      mockSearchParams = trackedParams;
      renderScreen();
      mockPlayer.currentTime = 599.8;
      mockPlayer.duration = 600;

      act(() => {
        jest.advanceTimersByTime(5000);
      });

      expect(mockUpdateMediaLocation).toHaveBeenCalledWith(expect.objectContaining({ location: 600 }));
    });

    it("does not clobber a saved position when the screen unmounts before playback advanced", () => {
      mockSearchParams = trackedParams;
      const { unmount } = renderScreen();

      unmount();

      expect(mockUpdateMediaLocation).not.toHaveBeenCalled();
    });

    it("saves the reached position when the screen unmounts", () => {
      mockSearchParams = trackedParams;
      const { unmount } = renderScreen();
      mockPlayer.currentTime = 77;

      act(() => {
        jest.advanceTimersByTime(5000);
      });
      mockUpdateMediaLocation.mockClear();

      unmount();

      expect(mockUpdateMediaLocation).toHaveBeenCalledWith(expect.objectContaining({ location: 77 }));
    });
  });

  describe("switching to another video", () => {
    it("shows the new video's position instead of the previous one's", async () => {
      mockSearchParams = {
        uri: "https://example.com/first.mp4",
        initialPosition: "1209",
        contentLength: "1800",
      };
      const { getByTestId } = renderScreen();
      expect(getByTestId("video-player").props.accessibilityValue).toEqual({ text: "20:09 of 30:00" });

      await act(async () => {
        mockSearchParams = { uri: "https://example.com/second.mp4", contentLength: "600" };
        mockSetAccessToken!("token-after-switch");
      });

      expect(getByTestId("video-player").props.accessibilityValue).toEqual({ text: "0:00 of 10:00" });
    });

    it("does not save the previous video's position against the new video", async () => {
      jest.useFakeTimers();
      mockUpdateMediaLocation.mockResolvedValue(undefined);
      mockRequestAPI.mockResolvedValueOnce({ playlist_url: "https://example.com/first.m3u8" });
      mockSearchParams = {
        uri: "https://example.com/first.mp4",
        streamingUrl: "mobile/url_redirects/stream/token/first",
        urlRedirectId: "redirect-1",
        productFileId: "file-1",
      };
      renderScreen();
      await act(async () => {});
      mockPlayer.currentTime = 599.8;
      mockPlayer.duration = 600;
      mockUpdateMediaLocation.mockClear();

      // The next video's stream lookup is still in flight, so the player is still playing the
      // previous file while the screen already reports the new one's identifiers.
      mockRequestAPI.mockReturnValueOnce(new Promise(() => {}));
      await act(async () => {
        mockSearchParams = {
          uri: "https://example.com/second.mp4",
          streamingUrl: "mobile/url_redirects/stream/token/second",
          urlRedirectId: "redirect-1",
          productFileId: "file-2",
        };
        mockSetAccessToken!("token-after-switch");
      });

      act(() => {
        jest.advanceTimersByTime(5000);
      });

      expect(mockUpdateMediaLocation).not.toHaveBeenCalled();
      jest.useRealTimers();
    });
  });

  // Backgrounding video is Android-only (see the platform split in app/video-player.tsx): iOS
  // sets staysActiveInBackground = true and keeps playing, so it needs no pause/resume handling.
  describe("app backgrounding (Android)", () => {
    let originalPlatform: string;

    beforeEach(() => {
      originalPlatform = Platform.OS;
      Object.defineProperty(Platform, "OS", { configurable: true, value: "android" });
    });

    afterEach(() => {
      Object.defineProperty(Platform, "OS", { configurable: true, value: originalPlatform });
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

    it("does not crash on background when the player has already been released", () => {
      renderScreen();
      mockPlayer.pause.mockImplementation(() => {
        throw Object.assign(new Error("Cannot use shared object that was already released"), {
          code: "ERR_USING_RELEASED_SHARED_OBJECT",
        });
      });

      expect(() => act(() => appStateCallback!("background"))).not.toThrow();
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

    it("does not register an AppState listener on iOS, where the player stays active", () => {
      Object.defineProperty(Platform, "OS", { configurable: true, value: "ios" });
      jest.spyOn(AppState, "addEventListener").mockClear();

      renderScreen();

      expect(AppState.addEventListener).not.toHaveBeenCalled();
    });

    it("sets staysActiveInBackground to true on iOS", () => {
      Object.defineProperty(Platform, "OS", { configurable: true, value: "ios" });

      renderScreen();

      expect(mockPlayer.staysActiveInBackground).toBe(true);
    });
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

  it("renders an error message when the player reports an error status", () => {
    const { queryByText } = renderScreen();

    act(() => {
      statusChangeListener!({ status: "error", error: { message: "AVPlayer cannot decode the file" } });
    });

    expect(queryByText("This video failed to load")).toBeTruthy();
    expect(queryByText("AVPlayer cannot decode the file")).toBeTruthy();
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });

  it("retries a transient network error without showing the failed screen", () => {
    mockPlayer.currentTime = 42;
    const { queryByText } = renderScreen();
    mockPlayer.play.mockClear();
    mockPlayer.replace.mockClear();

    act(() => {
      statusChangeListener!({ status: "error", error: { message: "The network connection was lost." } });
    });

    expect(queryByText("This video failed to load")).toBeNull();
    expect(mockPlayer.replace).toHaveBeenCalledWith("https://example.com/video.mp4");
    expect(mockPlayer.currentTime).toBe(42);
    expect(mockPlayer.play).toHaveBeenCalled();
  });

  it("uses asynchronous source replacement for iOS playback recovery", async () => {
    const originalPlatform = Platform.OS;
    const replaceAsync = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(mockPlayer, "replaceAsync", { configurable: true, value: replaceAsync });
    Object.defineProperty(Platform, "OS", { configurable: true, value: "ios" });
    try {
      mockPlayer.currentTime = 42;
      renderScreen();
      mockPlayer.play.mockClear();
      mockPlayer.replace.mockClear();

      await act(async () => {
        statusChangeListener!({ status: "error", error: { message: "The network connection was lost." } });
        await Promise.resolve();
      });

      expect(replaceAsync).toHaveBeenCalledWith("https://example.com/video.mp4");
      expect(mockPlayer.replace).not.toHaveBeenCalled();
      expect(mockPlayer.currentTime).toBe(42);
      expect(mockPlayer.play).toHaveBeenCalled();
    } finally {
      delete (mockPlayer as { replaceAsync?: unknown }).replaceAsync;
      Object.defineProperty(Platform, "OS", { configurable: true, value: originalPlatform });
    }
  });

  it("shows the failed screen after three transient playback errors", () => {
    const { queryByText } = renderScreen();

    act(() => {
      statusChangeListener!({ status: "error", error: { message: "The network connection was lost." } });
      statusChangeListener!({ status: "error", error: { message: "The network connection was lost." } });
      statusChangeListener!({ status: "error", error: { message: "The network connection was lost." } });
    });
    expect(queryByText("This video failed to load")).toBeNull();

    act(() => {
      statusChangeListener!({ status: "error", error: { message: "The network connection was lost." } });
    });
    expect(queryByText("This video failed to load")).toBeTruthy();
  });

  it("resets the automatic retry budget after playback progresses again", () => {
    const { queryByText } = renderScreen();
    mockPlayer.play.mockClear();
    mockPlayer.replace.mockClear();

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      const recoveryPosition = 40 + attempt;
      mockPlayer.currentTime = recoveryPosition;
      act(() => {
        statusChangeListener!({ status: "error", error: { message: "The network connection was lost." } });
      });
      expect(queryByText("This video failed to load")).toBeNull();
      expect(mockPlayer.replace).toHaveBeenCalledTimes(attempt);

      act(() => {
        statusChangeListener!({ status: "readyToPlay" });
        timeUpdateListener!({ currentTime: recoveryPosition + 0.25 });
      });
    }
  });

  it("keeps counting retries until playback moves past the recovery position", () => {
    const { queryByText } = renderScreen();

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      mockPlayer.currentTime = 42;
      act(() => {
        statusChangeListener!({ status: "error", error: { message: "The network connection was lost." } });
        statusChangeListener!({ status: "readyToPlay" });
      });
      expect(queryByText("This video failed to load")).toBeNull();
    }

    act(() => {
      statusChangeListener!({ status: "error", error: { message: "The network connection was lost." } });
    });
    expect(queryByText("This video failed to load")).toBeTruthy();
  });

  it("replays from the last position when Try again is pressed", () => {
    mockPlayer.currentTime = 18;
    const { getByLabelText, queryByText } = renderScreen();

    act(() => {
      statusChangeListener!({ status: "error", error: { message: "AVPlayer cannot decode the file" } });
    });
    mockPlayer.play.mockClear();
    mockPlayer.replace.mockClear();

    act(() => {
      fireEvent.press(getByLabelText("Try again"));
    });

    expect(queryByText("This video failed to load")).toBeNull();
    expect(mockPlayer.replace).toHaveBeenCalledWith("https://example.com/video.mp4");
    expect(mockPlayer.play).toHaveBeenCalled();
  });

  it("clears the error state once the player becomes ready to play", () => {
    const { queryByText } = renderScreen();

    act(() => {
      statusChangeListener!({ status: "error", error: { message: "AVPlayer cannot decode the file" } });
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
    expect(StatusBar.setHidden).toHaveBeenCalledWith(true, "fade");

    act(() => {
      getByTestId("video-player").props.onFullscreenExit();
    });
    expect(mockLockAsync).toHaveBeenCalledWith("portrait-up");
    expect(StatusBar.setHidden).toHaveBeenCalledWith(false, "fade");
  });

  it("hides the Android navigation bar for native fullscreen so system buttons do not cover the scrubber", async () => {
    const originalPlatform = Platform.OS;
    Object.defineProperty(Platform, "OS", { configurable: true, value: "android" });
    try {
      const { getByTestId } = renderScreen();
      mockSetNavigationBarVisibilityAsync.mockClear();

      await act(async () => {
        await getByTestId("video-player").props.onFullscreenEnter();
      });
      expect(mockSetNavigationBarVisibilityAsync).toHaveBeenCalledWith("hidden");

      act(() => {
        getByTestId("video-player").props.onFullscreenExit();
      });
      expect(mockSetNavigationBarVisibilityAsync).toHaveBeenCalledWith("visible");
    } finally {
      Object.defineProperty(Platform, "OS", { configurable: true, value: originalPlatform });
    }
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
      expect(mockPlayer.allowsExternalPlayback).toBe(false);
      expect(getByText("External caption text")).toBeTruthy();
    });

    it("restores external playback when external captions are turned off", async () => {
      const { getByTestId, getByText } = await renderWithExternalTrack();

      await act(async () => {
        fireEvent.press(getByTestId("captions-button"));
      });
      await act(async () => {
        fireEvent.press(getByText("English"));
      });
      expect(mockPlayer.allowsExternalPlayback).toBe(false);

      await act(async () => {
        fireEvent.press(getByTestId("captions-button"));
      });
      await act(async () => {
        fireEvent.press(getByText("Off"));
      });
      expect(mockPlayer.allowsExternalPlayback).toBe(true);
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
      expect(StatusBar.setHidden).toHaveBeenCalledWith(true, "fade");
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
      expect(StatusBar.setHidden).toHaveBeenCalledWith(false, "fade");
      expect(getByTestId("video-player")).toBeTruthy();
      expect(queryByTestId("fullscreen-video-player")).toBeNull();
      expect(mockLockAsync).toHaveBeenCalledWith("portrait-up");
    });

    it("hides and restores Android system bars around external-caption fullscreen", async () => {
      const originalPlatform = Platform.OS;
      Object.defineProperty(Platform, "OS", { configurable: true, value: "android" });
      try {
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

        expect(StatusBar.setHidden).toHaveBeenCalledWith(true, "fade");
        expect(mockSetNavigationBarVisibilityAsync).toHaveBeenCalledWith("hidden");

        await act(async () => {
          fireEvent.press(getByLabelText("Exit fullscreen"));
        });
        expect(StatusBar.setHidden).toHaveBeenCalledWith(false, "fade");
        expect(mockSetNavigationBarVisibilityAsync).toHaveBeenCalledWith("visible");
      } finally {
        Object.defineProperty(Platform, "OS", { configurable: true, value: originalPlatform });
      }
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

    it("refreshes an expired subtitle URL and retries once", async () => {
      const MockedSubtitleFetchError = jest.requireMock("@/lib/subtitle-fetch").SubtitleFetchError;
      mockFetchSubtitleText.mockRejectedValueOnce(new MockedSubtitleFetchError(403)).mockResolvedValueOnce(SRT);
      const { getByTestId, getByText } = await renderWithExternalTrack();
      mockRequestAPI.mockResolvedValueOnce({
        playlist_url: "https://example.com/index.m3u8",
        subtitles: [{ url: "https://example.com/fresh-captions.srt", language: "English" }],
      });

      await act(async () => {
        fireEvent.press(getByTestId("captions-button"));
      });
      await act(async () => {
        fireEvent.press(getByText("English"));
      });

      expect(mockRequestAPI).toHaveBeenCalledTimes(2);
      expect(mockFetchSubtitleText).toHaveBeenNthCalledWith(2, "https://example.com/fresh-captions.srt", {
        signal: expect.any(AbortSignal),
      });
      expect(getByText("External caption text")).toBeTruthy();
    });

    it("preserves external captions and fullscreen when the access token refreshes", async () => {
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
      mockRequestAPI.mockClear();
      jest.mocked(StatusBar.setHidden).mockClear();

      await act(async () => {
        mockSetAccessToken!("refreshed-token");
      });

      expect(mockRequestAPI).not.toHaveBeenCalled();
      expect(getByTestId("fullscreen-video-player")).toBeTruthy();
      expect(getByTestId("fullscreen-captions-button")).toBeTruthy();
      expect(StatusBar.setHidden).not.toHaveBeenCalledWith(false, "fade");
    });

    it("retries a failed stream lookup after the access token refreshes", async () => {
      jest.spyOn(console, "warn").mockImplementation();
      let resolveRetry: (stream: { playlist_url: string; subtitles: { url: string; language: string }[] }) => void;
      mockSearchParams = {
        uri: "https://example.com/video.mp4",
        streamingUrl: "mobile/url_redirects/stream/token/file",
        title: "Test Video",
      };
      mockRequestAPI.mockRejectedValueOnce(new Error("Unauthorized")).mockReturnValueOnce(
        new Promise((resolve) => {
          resolveRetry = resolve;
        }),
      );
      const { getByTestId, queryByTestId } = renderScreen();
      await act(async () => {});
      expect(queryByTestId("captions-button")).toBeNull();
      mockPlayer.currentTime = 137;
      mockPlayer.playing = false;
      mockPlayer.pause.mockClear();

      await act(async () => {
        mockSetAccessToken!("refreshed-token");
      });

      expect(mockRequestAPI).toHaveBeenNthCalledWith(2, "mobile/url_redirects/stream/token/file", {
        accessToken: "refreshed-token",
      });
      expect(getByTestId("video-player")).toBeTruthy();

      await act(async () => {
        resolveRetry!({
          playlist_url: "https://example.com/index.m3u8",
          subtitles: [{ url: "https://example.com/captions.srt", language: "English" }],
        });
      });

      expect(getByTestId("captions-button")).toBeTruthy();
      expect(mockPlayer.currentTime).toBe(137);
      expect(mockPlayer.pause).toHaveBeenCalled();
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
