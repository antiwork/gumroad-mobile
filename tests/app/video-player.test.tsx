import { AppState } from "react-native";
import { renderWithQueryClient } from "../render-with-query-client";

type StatusChangePayload = { status: string; error?: { message: string } };
let statusChangeListener: ((payload: StatusChangePayload) => void) | null = null;
const mockSubscriptionRemove = jest.fn();

const mockPlayer = {
  loop: false,
  staysActiveInBackground: true,
  playing: true,
  currentTime: 0,
  play: jest.fn(),
  pause: jest.fn(),
  addListener: jest.fn((eventName: string, listener: (payload: StatusChangePayload) => void) => {
    if (eventName === "statusChange") statusChangeListener = listener;
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

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ uri: "https://example.com/video.mp4", title: "Test Video" }),
  Stack: { Screen: () => null },
}));

jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ accessToken: "test-token" }),
}));

jest.mock("@/lib/media-location", () => ({
  updateMediaLocation: jest.fn(),
}));

import VideoPlayerScreen from "@/app/video-player";
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
    appStateCallback = null;
    statusChangeListener = null;

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
});
