import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Platform, StatusBar } from "react-native";

const mockRouterBack = jest.fn();
const mockLockAsync = jest.fn().mockResolvedValue(undefined);
const mockUnlockAsync = jest.fn().mockResolvedValue(undefined);
const mockSetNavigationBarVisibilityAsync = jest.fn().mockResolvedValue(undefined);
const mockSafeOpenURL = jest.fn();
const mockUseAuth = jest.fn();

jest.mock("@/lib/auth-context", () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock("@/lib/open-url", () => ({
  safeOpenURL: (url: string) => mockSafeOpenURL(url),
}));

jest.mock("expo-router", () => ({
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ token: "test-token", title: "My Game" }),
  useRouter: () => ({ back: mockRouterBack }),
}));

jest.mock("expo-screen-orientation", () => ({
  lockAsync: (...args: unknown[]) => mockLockAsync(...args),
  unlockAsync: (...args: unknown[]) => mockUnlockAsync(...args),
  OrientationLock: { LANDSCAPE: "landscape", PORTRAIT_UP: "portrait-up" },
}));

jest.mock("expo-navigation-bar", () => ({
  setVisibilityAsync: (...args: unknown[]) => mockSetNavigationBarVisibilityAsync(...args),
}));

jest.mock("@/components/styled", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    StyledWebView: React.forwardRef(function MockWebView(props: Record<string, unknown>, ref: unknown) {
      React.useImperativeHandle(ref, () => ({}));
      return React.createElement(View, { testID: "build-player-webview", ...props });
    }),
  };
});

import BuildPlayerScreen from "@/app/web-build-player";

const expectedUrl =
  "https://example.com/d/test-token/play?display=mobile_app&access_token=test-access-token&mobile_token=test-mobile-token";

const getShouldStart = () =>
  screen.getByTestId("build-player-webview").props.onShouldStartLoadWithRequest as (request: {
    url: string;
    navigationType: string;
    mainDocumentURL?: string;
  }) => boolean;

const enterFullscreen = async () => {
  await act(async () => {
    fireEvent.press(screen.getByTestId("fullscreen-button"));
  });
};

describe("BuildPlayerScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(StatusBar, "setHidden").mockImplementation();
    mockUseAuth.mockReturnValue({ isLoading: false, accessToken: "test-access-token" });
  });

  it("loads the purchase's player page with the app session", () => {
    render(<BuildPlayerScreen />);

    expect(screen.getByTestId("build-player-webview").props.source).toEqual({ uri: expectedUrl });
  });

  it("lets media play inline and use the fullscreen API, in a session of its own", () => {
    render(<BuildPlayerScreen />);
    const webView = screen.getByTestId("build-player-webview").props;

    expect(webView.incognito).toBe(true);
    expect(webView.allowsInlineMediaPlayback).toBe(true);
    expect(webView.allowsFullscreenVideo).toBe(true);
    expect(webView.mediaPlaybackRequiresUserAction).toBe(false);
  });

  it("waits for the session before loading the page", () => {
    mockUseAuth.mockReturnValue({ isLoading: true, accessToken: null });
    render(<BuildPlayerScreen />);

    expect(screen.queryByTestId("build-player-webview")).toBeNull();
  });

  it("gives fullscreen landscape and hides the system bars", async () => {
    render(<BuildPlayerScreen />);

    await enterFullscreen();

    expect(mockLockAsync).toHaveBeenCalledWith("landscape");
    expect(StatusBar.setHidden).toHaveBeenCalledWith(true, "fade");
    expect(screen.getByTestId("exit-fullscreen-button")).toBeTruthy();
  });

  it("hides the Android navigation bar so system buttons do not cover the build", async () => {
    const originalPlatform = Platform.OS;
    Object.defineProperty(Platform, "OS", { configurable: true, value: "android" });
    try {
      render(<BuildPlayerScreen />);

      await enterFullscreen();

      expect(mockSetNavigationBarVisibilityAsync).toHaveBeenCalledWith("hidden");
    } finally {
      Object.defineProperty(Platform, "OS", { configurable: true, value: originalPlatform });
    }
  });

  it("restores portrait and the system bars when fullscreen exits", async () => {
    render(<BuildPlayerScreen />);
    await enterFullscreen();
    mockLockAsync.mockClear();

    fireEvent.press(screen.getByTestId("exit-fullscreen-button"));

    expect(mockLockAsync).toHaveBeenCalledWith("portrait-up");
    expect(StatusBar.setHidden).toHaveBeenCalledWith(false, "fade");
    expect(screen.queryByTestId("exit-fullscreen-button")).toBeNull();
  });

  it("restores the app orientation when the player is left while fullscreen", async () => {
    const { unmount } = render(<BuildPlayerScreen />);
    await enterFullscreen();
    mockLockAsync.mockClear();

    unmount();

    expect(mockLockAsync).toHaveBeenCalledWith("portrait-up");
    expect(StatusBar.setHidden).toHaveBeenCalledWith(false, "fade");
  });

  it("keeps the player page and the frame the build runs in", () => {
    render(<BuildPlayerScreen />);
    const shouldStart = getShouldStart();

    expect(shouldStart({ url: expectedUrl, navigationType: "other" })).toBe(true);
    expect(
      shouldStart({
        url: "https://example.com/d/test-token/play/grant/",
        navigationType: "other",
        mainDocumentURL: expectedUrl,
      }),
    ).toBe(true);
    expect(shouldStart({ url: "about:blank", navigationType: "other" })).toBe(true);
    expect(mockSafeOpenURL).not.toHaveBeenCalled();
  });

  it("closes the player when the player page's own back link is tapped", () => {
    render(<BuildPlayerScreen />);
    const shouldStart = getShouldStart();

    expect(shouldStart({ url: "https://example.com/d/test-token?display=mobile_app", navigationType: "click" })).toBe(
      false,
    );
    expect(mockRouterBack).toHaveBeenCalled();
  });

  it("hands a new-window link inside the build to the OS", () => {
    render(<BuildPlayerScreen />);
    const onOpenWindow = screen.getByTestId("build-player-webview").props.onOpenWindow as (event: {
      nativeEvent: { targetUrl: string };
    }) => void;

    onOpenWindow({ nativeEvent: { targetUrl: "https://example.org/store" } });

    expect(mockSafeOpenURL).toHaveBeenCalledWith("https://example.org/store");
  });

  it("opens links that are not the build outside the WebView", () => {
    render(<BuildPlayerScreen />);
    const shouldStart = getShouldStart();

    expect(shouldStart({ url: "https://example.org/test", navigationType: "click" })).toBe(false);
    expect(mockSafeOpenURL).toHaveBeenCalledWith("https://example.org/test");
  });

  it("opens a new-window link to another Gumroad page outside the WebView", () => {
    render(<BuildPlayerScreen />);
    const onOpenWindow = screen.getByTestId("build-player-webview").props.onOpenWindow as (event: {
      nativeEvent: { targetUrl: string };
    }) => void;

    onOpenWindow({ nativeEvent: { targetUrl: "https://example.com/l/other" } });
    onOpenWindow({ nativeEvent: { targetUrl: "about:blank" } });

    expect(mockSafeOpenURL).toHaveBeenCalledTimes(1);
    expect(mockSafeOpenURL).toHaveBeenCalledWith("https://example.com/l/other");
  });

  it("ignores a second Full screen tap while the first is applying", async () => {
    render(<BuildPlayerScreen />);

    await act(async () => {
      fireEvent.press(screen.getByTestId("fullscreen-button"));
      fireEvent.press(screen.getByTestId("fullscreen-button"));
    });

    expect(mockLockAsync).toHaveBeenCalledTimes(1);
  });

  it("restores portrait when the system bars cannot be hidden", async () => {
    mockSetNavigationBarVisibilityAsync.mockRejectedValueOnce(new Error("no bar"));
    Platform.OS = "android";
    render(<BuildPlayerScreen />);

    await enterFullscreen();

    expect(mockLockAsync).toHaveBeenLastCalledWith("portrait-up");
    expect(screen.getByTestId("fullscreen-button")).toBeTruthy();
  });
});
