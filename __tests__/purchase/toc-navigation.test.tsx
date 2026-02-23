import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { act } from "react";

const mockPush = jest.fn();
const mockInjectJavaScript = jest.fn();

jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ accessToken: "test-token", isLoading: false }),
}));

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "test-token-123" }),
  useRouter: () => ({ push: mockPush }),
  Stack: { Screen: () => null },
}));

jest.mock("@/app/(tabs)/library", () => ({
  usePurchases: () => ({
    data: [
      {
        name: "Test Product",
        url_redirect_token: "test-token-123",
        creator_name: "Test Creator",
        thumbnail_url: null,
        purchase_id: "purchase-1",
        file_data: [],
      },
    ],
  }),
}));

jest.mock("@/components/use-audio-player-sync", () => ({
  useAudioPlayerSync: () => ({ pauseAudio: jest.fn(), playAudio: jest.fn() }),
}));

jest.mock("expo-file-system", () => ({
  File: { downloadFileAsync: jest.fn() },
  Paths: { cache: "/cache" },
}));

jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn(),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 34, left: 0, right: 0 }),
}));

jest.mock("react-native-track-player", () => ({
  __esModule: true,
  default: {
    getActiveTrack: jest.fn().mockResolvedValue(undefined),
    pause: jest.fn(),
    play: jest.fn(),
    getProgress: jest.fn().mockResolvedValue({ position: 0, duration: 0 }),
    seekTo: jest.fn(),
  },
  State: { Playing: "playing", Buffering: "buffering", Loading: "loading" },
  useActiveTrack: () => undefined,
  usePlaybackState: () => ({ state: undefined }),
  useProgress: () => ({ position: 0, duration: 0 }),
}));

jest.mock("react-native-webview", () => {
  const { forwardRef, useImperativeHandle } = require("react");
  const { View } = require("react-native");
  const WebView = forwardRef((props: Record<string, unknown>, ref: unknown) => {
    useImperativeHandle(ref, () => ({
      injectJavaScript: mockInjectJavaScript,
    }));
    return <View testID="webview" {...props} />;
  });
  WebView.displayName = "WebView";
  return { WebView, WebViewMessageEvent: {} };
});

jest.mock("@/components/styled", () => {
  const { forwardRef, useImperativeHandle } = require("react");
  const { View } = require("react-native");
  const StyledWebView = forwardRef((props: Record<string, unknown>, ref: unknown) => {
    useImperativeHandle(ref, () => ({
      injectJavaScript: mockInjectJavaScript,
    }));
    return <View testID="styled-webview" {...props} />;
  });
  StyledWebView.displayName = "StyledWebView";
  return { StyledWebView, StyledImage: View };
});

const renderScreen = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const DownloadScreen = require("@/app/purchase/[id]").default;
  return render(
    <QueryClientProvider client={queryClient}>
      <DownloadScreen />
    </QueryClientProvider>,
  );
};

const simulateTocMessage = (payload: {
  items: { id: string; title: string }[];
  currentIndex: number;
  hasNext: boolean;
  hasPrev: boolean;
}) => {
  const webview = screen.getByTestId("styled-webview");
  const onMessage = webview.props.onMessage;
  act(() => {
    onMessage({
      nativeEvent: {
        data: JSON.stringify({ type: "toc_state", payload }),
      },
    });
  });
};

const MULTI_ITEM_PAYLOAD = {
  items: [
    { id: "0", title: "Introduction" },
    { id: "1", title: "Chapter 1" },
    { id: "2", title: "Chapter 2" },
  ],
  currentIndex: 1,
  hasNext: true,
  hasPrev: true,
};

const SINGLE_ITEM_PAYLOAD = {
  items: [{ id: "0", title: "Only page" }],
  currentIndex: 0,
  hasNext: false,
  hasPrev: false,
};

describe("TOC Navigation Footer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("injects TOC bridge JavaScript into the WebView", () => {
    renderScreen();
    const webview = screen.getByTestId("styled-webview");
    const injectedJS = webview.props.injectedJavaScript;
    expect(injectedJS).toBeDefined();
    expect(injectedJS).toContain("__tocBridgeInitialized");
    expect(injectedJS).toContain("ReactNativeWebView.postMessage");
    expect(injectedJS).toContain("native_navigate_toc");
    expect(injectedJS).toContain('role="navigation"');
    expect(injectedJS).toContain("MutationObserver");
  });

  it("footer does not render when no toc_state has been received", () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation();
    renderScreen();
    simulateTocMessage(MULTI_ITEM_PAYLOAD);
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("footer does not render when toc_state has only one item", () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation();
    renderScreen();
    simulateTocMessage(SINGLE_ITEM_PAYLOAD);
    expect(screen.queryByText("Prev")).toBeNull();
    expect(screen.queryByText("Next")).toBeNull();
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("footer renders when toc_state payload contains more than one item", () => {
    renderScreen();
    simulateTocMessage(MULTI_ITEM_PAYLOAD);
    expect(screen.getByText("Contents")).toBeTruthy();
    expect(screen.getByText("Prev")).toBeTruthy();
    expect(screen.getByText("Next")).toBeTruthy();
  });

  it("Prev button does not trigger navigation when hasPrev is false", () => {
    renderScreen();
    simulateTocMessage({ ...MULTI_ITEM_PAYLOAD, currentIndex: 0, hasPrev: false });
    fireEvent.press(screen.getByText("Prev"));
    expect(mockInjectJavaScript).not.toHaveBeenCalled();
  });

  it("Next button does not trigger navigation when hasNext is false", () => {
    renderScreen();
    simulateTocMessage({ ...MULTI_ITEM_PAYLOAD, currentIndex: 2, hasNext: false });
    fireEvent.press(screen.getByText("Next"));
    expect(mockInjectJavaScript).not.toHaveBeenCalled();
  });

  it("Prev button triggers navigation to previous index", () => {
    renderScreen();
    simulateTocMessage(MULTI_ITEM_PAYLOAD);
    fireEvent.press(screen.getByText("Prev"));
    expect(mockInjectJavaScript).toHaveBeenCalledWith(
      expect.stringContaining("native_navigate_toc"),
    );
    expect(mockInjectJavaScript).toHaveBeenCalledWith(
      expect.stringContaining("index: 0"),
    );
    expect(mockInjectJavaScript).toHaveBeenCalledWith(
      expect.stringMatching(/\)\); true;$/),
    );
  });

  it("Next button triggers navigation to next index", () => {
    renderScreen();
    simulateTocMessage(MULTI_ITEM_PAYLOAD);
    fireEvent.press(screen.getByText("Next"));
    expect(mockInjectJavaScript).toHaveBeenCalledWith(
      expect.stringContaining("native_navigate_toc"),
    );
    expect(mockInjectJavaScript).toHaveBeenCalledWith(
      expect.stringContaining("index: 2"),
    );
  });

  it("Contents button opens toc sheet", () => {
    renderScreen();
    simulateTocMessage(MULTI_ITEM_PAYLOAD);
    fireEvent.press(screen.getByText("Contents"));
    expect(screen.getByText("Introduction")).toBeTruthy();
    expect(screen.getByText("Chapter 1")).toBeTruthy();
    expect(screen.getByText("Chapter 2")).toBeTruthy();
  });

  it("toc sheet item press navigates to target index and closes sheet", () => {
    renderScreen();
    simulateTocMessage(MULTI_ITEM_PAYLOAD);
    fireEvent.press(screen.getByText("Contents"));
    fireEvent.press(screen.getByText("Introduction"));
    expect(mockInjectJavaScript).toHaveBeenCalledWith(
      expect.stringContaining("index: 0"),
    );
  });

  it("click messages are still handled correctly after toc_state received", async () => {
    renderScreen();
    simulateTocMessage(MULTI_ITEM_PAYLOAD);
    expect(screen.getByText("Contents")).toBeTruthy();
    const webview = screen.getByTestId("styled-webview");
    const onMessage = webview.props.onMessage;
    await act(async () => {
      onMessage({
        nativeEvent: {
          data: JSON.stringify({
            type: "click",
            payload: {
              resourceId: "file-1",
              isDownload: false,
              isPost: false,
              extension: "PDF",
            },
          }),
        },
      });
    });
    expect(mockPush).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: "/pdf-viewer" }),
    );
  });
});
