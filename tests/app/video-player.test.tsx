import { AppState } from "react-native";
import { renderWithQueryClient } from "../render-with-query-client";

type StatusChangePayload = { status: string; error?: { message: string } };
let statusChangeListener: ((payload: StatusChangePayload) => void) | null = null;
let subtitleTrackChangeListener: ((payload: { subtitleTrack: unknown }) => void) | null = null;
let timeUpdateListener: ((payload: { currentTime: number }) => void) | null = null;
const mockSubscriptionRemove = jest.fn();

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
    if (eventName === "statusChange") statusChangeListener = listener as typeof statusChangeListener;
    if (eventName === "subtitleTrackChange")
      subtitleTrackChangeListener = listener as typeof subtitleTrackChangeListener;
    if (eventName === "timeUpdate") timeUpdateListener = listener as typeof timeUpdateListener;
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
    mockPlayer.subtitleTrack = null;
    mockPlayer.availableSubtitleTracks = [];
    appStateCallback = null;
    statusChangeListener = null;
    subtitleTrackChangeListener = null;
    timeUpdateListener = null;
    mockSearchParams = { uri: "https://example.com/video.mp4", title: "Test Video" };
    mockRequestAPI.mockReset();

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
      global.fetch = jest
        .fn()
        .mockResolvedValue({ ok: true, text: () => Promise.resolve(SRT) }) as unknown as typeof fetch;
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
    });

    it("fetches, parses, and renders an external subtitle track when selected", async () => {
      const { getByTestId, getByText } = await renderWithExternalTrack();

      await act(async () => {
        fireEvent.press(getByTestId("captions-button"));
      });
      await act(async () => {
        fireEvent.press(getByText("English"));
      });

      expect(global.fetch).toHaveBeenCalledWith("https://example.com/captions.srt");
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
      global.fetch = jest.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;
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

    it("treats a non-success subtitle response as a failure and does not cache it", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: () => Promise.resolve("<Error>Access Denied</Error>"),
      }) as unknown as typeof fetch;
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

      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it("ignores a stale subtitle fetch when the buyer selects Off before it resolves", async () => {
      let resolveFetch: (value: { ok: boolean; text: () => Promise<string> }) => void;
      global.fetch = jest.fn().mockReturnValue(
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
      ) as unknown as typeof fetch;
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

      await act(async () => {
        resolveFetch!({ ok: true, text: () => Promise.resolve(SRT) });
      });

      expect(queryByTestId("subtitle-overlay")).toBeNull();
      expect(queryByText("External caption text")).toBeNull();
    });

    it("ignores a stale subtitle fetch when the native controls enable an embedded track before it resolves", async () => {
      let resolveFetch: (value: { ok: boolean; text: () => Promise<string> }) => void;
      global.fetch = jest.fn().mockReturnValue(
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
      ) as unknown as typeof fetch;
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

      await act(async () => {
        resolveFetch!({ ok: true, text: () => Promise.resolve(SRT) });
      });

      expect(queryByTestId("subtitle-overlay")).toBeNull();
    });
  });
});
