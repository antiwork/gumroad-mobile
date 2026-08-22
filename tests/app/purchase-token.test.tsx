import { act, fireEvent, render, screen } from "@testing-library/react-native";

const mockUseAuth = jest.fn();
const mockSafeOpenURL = jest.fn();

jest.mock("@/lib/auth-context", () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock("@/lib/open-url", () => ({
  safeOpenURL: (url: string) => mockSafeOpenURL(url),
}));

const mockRouterPush = jest.fn();

jest.mock("expo-router", () => ({
  Stack: {
    Screen: () => null,
  },
  useLocalSearchParams: () => ({ token: "test-token", urlRedirectExternalId: "redirect-id" }),
  useRouter: () => ({ push: mockRouterPush }),
}));

jest.mock("expo-file-system", () => ({
  File: { downloadFileAsync: jest.fn() },
  Paths: { cache: "/cache" },
}));

jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));

jest.mock("@/components/library/use-purchases", () => ({
  usePurchase: () => mockUsePurchase(),
  fetchPurchaseDetail: jest.fn(),
}));

jest.mock("@/components/library/use-recent-products", () => ({
  useAddRecentPurchase: () => jest.fn(),
}));

const mockPauseAudio = jest.fn();
const mockPlayAudio = jest.fn();
const mockUsePurchase = jest.fn();
let mockPlayerState: { activeResourceId: string | null; isPlaying: boolean } = {
  activeResourceId: null,
  isPlaying: false,
};

jest.mock("@/components/use-audio-player-sync", () => ({
  useAudioPlayerSync: () => ({
    pauseAudio: mockPauseAudio,
    playAudio: mockPlayAudio,
    activeResourceId: mockPlayerState.activeResourceId,
    isPlaying: mockPlayerState.isPlaying,
  }),
}));

jest.mock("@/components/mini-audio-player", () => ({
  MiniAudioPlayer: () => null,
}));

jest.mock("@/components/content-page-nav", () => ({
  ContentPageNav: () => null,
}));

jest.mock("@/components/styled", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    StyledWebView: React.forwardRef(function MockWebView(props: Record<string, unknown>, ref: unknown) {
      React.useImperativeHandle(ref, () => ({ postMessage: jest.fn() }));
      return React.createElement(View, { testID: "purchase-webview", ...props });
    }),
  };
});

import DownloadScreen from "@/app/purchase/[token]";

const expectedUrl =
  "https://example.com/d/test-token?display=mobile_app&access_token=test-access-token&mobile_token=test-mobile-token";

const getShouldStart = () =>
  screen.getByTestId("purchase-webview").props.onShouldStartLoadWithRequest as (request: {
    url: string;
    navigationType: string;
    mainDocumentURL?: string;
  }) => boolean;

describe("DownloadScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({ isLoading: false, accessToken: "test-access-token" });
    mockUsePurchase.mockReturnValue(undefined);
    mockPlayerState = { activeResourceId: null, isPlaying: false };
  });

  it("keeps Gumroad navigation and WebView-internal schemes in the WebView", () => {
    render(<DownloadScreen />);
    const shouldStart = getShouldStart();

    expect(shouldStart({ url: expectedUrl, navigationType: "other" })).toBe(true);
    expect(shouldStart({ url: "https://example.com/library", navigationType: "click" })).toBe(true);
    expect(shouldStart({ url: "about:blank", navigationType: "other" })).toBe(true);
    expect(shouldStart({ url: "https://challenges.cloudflare.com/turnstile", navigationType: "other" })).toBe(true);
    expect(
      shouldStart({ url: "https://cdn.example.test/embed", navigationType: "other", mainDocumentURL: expectedUrl }),
    ).toBe(true);
    expect(mockSafeOpenURL).not.toHaveBeenCalled();
  });

  it("opens external web links outside the WebView", () => {
    render(<DownloadScreen />);
    const shouldStart = getShouldStart();

    expect(shouldStart({ url: "https://external.example/test", navigationType: "click" })).toBe(false);
    expect(mockSafeOpenURL).toHaveBeenCalledWith("https://external.example/test");
  });

  it("hands non-web scheme navigations to the OS instead of loading them in the WebView", () => {
    render(<DownloadScreen />);
    const shouldStart = getShouldStart();

    expect(shouldStart({ url: "mailto:support@example.com", navigationType: "click" })).toBe(false);
    expect(mockSafeOpenURL).toHaveBeenCalledWith("mailto:support@example.com");

    mockSafeOpenURL.mockClear();
    expect(shouldStart({ url: "intent://pay#Intent;scheme=upi;end", navigationType: "click" })).toBe(false);
    expect(mockSafeOpenURL).toHaveBeenCalledWith("intent://pay#Intent;scheme=upi;end");
  });

  it("lets video in the purchase content play inline and go fullscreen", () => {
    render(<DownloadScreen />);

    expect(screen.getByTestId("purchase-webview").props.incognito).toBe(true);
    expect(screen.getByTestId("purchase-webview").props.sharedCookiesEnabled).toBeUndefined();
    expect(screen.getByTestId("purchase-webview").props.allowsInlineMediaPlayback).toBe(true);
    expect(screen.getByTestId("purchase-webview").props.allowsFullscreenVideo).toBe(true);
  });

  const purchaseWithAudio = {
    purchase_id: "purchase-1",
    url_redirect_external_id: "redirect-1",
    file_data: [
      { id: "ep1", filegroup: "audio", name: "Episode 1", content_length: 223 },
      { id: "ep2", filegroup: "audio", name: "Episode 2", content_length: 223 },
    ],
  };

  const sendAudioTap = async (resourceId: string, claimedIsPlaying: string) => {
    const onMessage = screen.getByTestId("purchase-webview").props.onMessage as (event: {
      nativeEvent: { data: string };
    }) => Promise<void>;
    await onMessage({
      nativeEvent: {
        data: JSON.stringify({
          type: "click",
          payload: { type: "audio", resourceId, isPlaying: claimedIsPlaying, isDownload: false },
        }),
      },
    });
  };

  it("pauses when the tapped audio row is the actively playing track", async () => {
    mockUsePurchase.mockReturnValue(purchaseWithAudio);
    mockPlayerState = { activeResourceId: "ep1", isPlaying: true };
    render(<DownloadScreen />);

    await sendAudioTap("ep1", "true");

    expect(mockPauseAudio).toHaveBeenCalled();
    expect(mockPlayAudio).not.toHaveBeenCalled();
  });

  it("plays the tapped audio row when its stale isPlaying claim does not match the native player", async () => {
    mockUsePurchase.mockReturnValue(purchaseWithAudio);
    mockPlayerState = { activeResourceId: "ep2", isPlaying: true };
    render(<DownloadScreen />);

    await sendAudioTap("ep1", "true");

    expect(mockPauseAudio).not.toHaveBeenCalled();
    expect(mockPlayAudio).toHaveBeenCalledWith(expect.objectContaining({ resourceId: "ep1" }));
  });

  it("plays the tapped audio row when nothing is playing even if the row claims to be playing", async () => {
    mockUsePurchase.mockReturnValue(purchaseWithAudio);
    mockPlayerState = { activeResourceId: "ep1", isPlaying: false };
    render(<DownloadScreen />);

    await sendAudioTap("ep1", "true");

    expect(mockPauseAudio).not.toHaveBeenCalled();
    expect(mockPlayAudio).toHaveBeenCalledWith(expect.objectContaining({ resourceId: "ep1" }));
  });

  describe("opening a video", () => {
    const sendVideoTap = async (resourceId: string, resumeAt?: string) => {
      const onMessage = screen.getByTestId("purchase-webview").props.onMessage as (event: {
        nativeEvent: { data: string };
      }) => Promise<void>;
      await onMessage({
        nativeEvent: {
          data: JSON.stringify({ type: "click", payload: { resourceId, resumeAt, isDownload: false } }),
        },
      });
    };

    const purchaseWithVideo = {
      purchase_id: "purchase-1",
      url_redirect_external_id: "redirect-1",
      file_data: [
        {
          id: "vid1",
          filegroup: "video",
          name: "Lesson 1",
          content_length: 1800,
          streaming_url: "mobile/url_redirects/stream/token/vid1",
          latest_media_location: { location: 1209 },
        },
      ],
    };

    it("passes the saved position from the API when the WebView payload omits it", async () => {
      mockUsePurchase.mockReturnValue(purchaseWithVideo);
      render(<DownloadScreen />);

      await sendVideoTap("vid1");

      expect(mockRouterPush).toHaveBeenCalledWith(
        expect.objectContaining({
          pathname: "/video-player",
          params: expect.objectContaining({ initialPosition: 1209, contentLength: 1800 }),
        }),
      );
    });

    it("prefers the saved position over a stale WebView payload", async () => {
      mockUsePurchase.mockReturnValue(purchaseWithVideo);
      render(<DownloadScreen />);

      await sendVideoTap("vid1", "0");

      expect(mockRouterPush).toHaveBeenCalledWith(
        expect.objectContaining({ params: expect.objectContaining({ initialPosition: 1209 }) }),
      );
    });

    it("falls back to the WebView payload when the API has no saved position", async () => {
      mockUsePurchase.mockReturnValue({
        ...purchaseWithVideo,
        file_data: [{ ...purchaseWithVideo.file_data[0], latest_media_location: undefined }],
      });
      render(<DownloadScreen />);

      await sendVideoTap("vid1", "45");

      expect(mockRouterPush).toHaveBeenCalledWith(
        expect.objectContaining({ params: expect.objectContaining({ initialPosition: "45" }) }),
      );
    });
  });

  it("shows the native audio list for every API audio file", async () => {
    mockUsePurchase.mockReturnValue(purchaseWithAudio);
    render(<DownloadScreen />);

    expect(screen.getByTestId("purchase-audio-files")).toBeTruthy();
  });

  it("hides the native audio list when the purchase has no audio files", async () => {
    mockUsePurchase.mockReturnValue({ ...purchaseWithAudio, file_data: [] });
    render(<DownloadScreen />);

    expect(screen.queryByTestId("purchase-audio-files")).toBeNull();
  });

  it("plays an audio file from the native list", async () => {
    mockUsePurchase.mockReturnValue(purchaseWithAudio);
    render(<DownloadScreen />);

    fireEvent.press(screen.getByTestId("purchase-audio-files"));
    fireEvent.press(screen.getByTestId("purchase-audio-file-ep2"));

    expect(mockPlayAudio).toHaveBeenCalledWith(expect.objectContaining({ resourceId: "ep2" }));
  });
});
