/* eslint-disable import/first -- jest.mock must precede imports */
import { render, screen } from "@testing-library/react-native";

const mockUseInstallment = jest.fn();
const mockUsePurchase = jest.fn();

jest.mock("react-native-webview", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    WebView: React.forwardRef(function MockWebView(props: Record<string, unknown>, ref: unknown) {
      React.useImperativeHandle(ref, () => ({ postMessage: jest.fn() }));
      return React.createElement(View, { testID: "post-webview", ...props });
    }),
  };
});

jest.mock("@/components/library/use-purchases", () => ({
  useInstallment: () => mockUseInstallment(),
  usePurchase: () => mockUsePurchase(),
  fetchPurchaseDetail: jest.fn(),
}));

jest.mock("@/components/use-audio-player-sync", () => ({
  useAudioPlayerSync: () => ({
    playAudio: jest.fn(),
    pauseAudio: jest.fn(),
    activeResourceId: null,
    isPlaying: false,
  }),
}));

jest.mock("@/components/mini-audio-player", () => ({ MiniAudioPlayer: () => null }));

jest.mock("@/lib/auth-context", () => ({ useAuth: () => ({ accessToken: "test-token" }) }));

jest.mock("expo-router", () => ({
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ id: "post-1", purchaseId: "purchase-1" }),
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("expo-file-system", () => ({
  File: { downloadFileAsync: jest.fn() },
  Paths: { cache: "/cache" },
}));

jest.mock("uniwind", () => ({
  ...jest.requireActual("uniwind"),
  useCSSVariable: () => ["#000000", "#ffffff", "Mabry Pro"],
}));

import PostScreen from "@/app/post/[id]";

describe("PostScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseInstallment.mockReturnValue({
      name: "Lesson 1",
      message: "<p>Watch this</p>",
      published_at: "2026-07-01T00:00:00Z",
      creator_name: "Seller",
      url_redirect_external_id: "redirect-1",
      files_data: [],
    });
    mockUsePurchase.mockReturnValue({
      purchase_id: "purchase-1",
      url_redirect_token: "token-1",
    });
  });

  it("lets video in a post body play inline and go fullscreen", () => {
    render(<PostScreen />);

    const webView = screen.getByTestId("post-webview");
    expect(webView.props.allowsInlineMediaPlayback).toBe(true);
    expect(webView.props.allowsFullscreenVideo).toBe(true);
  });
});
