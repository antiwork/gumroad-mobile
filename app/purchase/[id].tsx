import { usePurchases } from "@/app/(tabs)/library";
import { ContentPage, ContentPagesFooter } from "@/components/content-pages-footer";
import { MiniAudioPlayer } from "@/components/mini-audio-player";
import { StyledWebView } from "@/components/styled";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Screen } from "@/components/ui/screen";
import { useAudioPlayerSync } from "@/components/use-audio-player-sync";
import { useAuth } from "@/lib/auth-context";
import { env } from "@/lib/env";
import { buildApiUrl } from "@/lib/request";
import { File, Paths } from "expo-file-system";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { useCallback, useRef, useState } from "react";
import { Alert, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView as BaseWebView, WebViewMessageEvent } from "react-native-webview";

// See antiwork/gumroad:app/javascript/components/Download/Interactions.tsx
type ClickPayload = {
  resourceId: string;
  isDownload: boolean;
  isPost: boolean;
  type?: string | null;
  extension?: string | null;
  isPlaying?: "true" | "false" | null;
  resumeAt?: string | null;
  contentLength?: string | null;
};

type ClickMessage = {
  type: "click";
  payload: ClickPayload;
};

type ContentPagesMessage = {
  type: "contentPages";
  payload: {
    pages: ContentPage[];
    activeIndex: number;
  };
};

type WebViewMessage = ClickMessage | ContentPagesMessage;

const downloadUrl = (token: string, productFileId: string) =>
  buildApiUrl(`/mobile/url_redirects/download/${token}/${productFileId}`);

const downloadFile = (token: string, productFileId: string) =>
  File.downloadFileAsync(downloadUrl(token, productFileId), Paths.cache, {
    idempotent: true,
  });

const shareFile = async (uri: string) => {
  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) throw new Error("Sharing is not available on this device");
  await Sharing.shareAsync(uri);
};

// JavaScript injected into the WebView to:
// 1. Hide the HTML table of contents / prev-next navigation
// 2. Extract page data and send it to React Native
// 3. Listen for page change messages from React Native
const INJECTED_JS = `
(function() {
  function extractAndHideTOC() {
    var nav = document.querySelector('[role="navigation"]');
    if (!nav) return;
    nav.style.display = 'none';

    var pages = [];
    var activeIndex = 0;
    var menuItems = nav.querySelectorAll('[role="menuitemradio"]');

    if (menuItems.length > 0) {
      menuItems.forEach(function(item, index) {
        var text = item.textContent.trim().replace(/^\\\\s+/, '');
        var isActive = item.getAttribute('aria-checked') === 'true';
        if (isActive) activeIndex = index;
        pages.push({ id: 'page-' + index, title: text });
      });
    } else {
      var tocButton = nav.querySelector('[aria-label="Table of Contents"]');
      if (tocButton) {
        tocButton.click();
        setTimeout(function() {
          var items = document.querySelectorAll('[role="menuitemradio"]');
          var p = [];
          var ai = 0;
          items.forEach(function(item, index) {
            var text = item.textContent.trim().replace(/^\\\\s+/, '');
            if (item.getAttribute('aria-checked') === 'true') ai = index;
            p.push({ id: 'page-' + index, title: text });
          });
          document.body.click();
          if (p.length > 0 && window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'contentPages',
              payload: { pages: p, activeIndex: ai }
            }));
          }
        }, 100);
        return;
      }
    }

    if (pages.length > 0 && window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'contentPages',
        payload: { pages: pages, activeIndex: activeIndex }
      }));
    }
  }

  window.addEventListener('message', function(event) {
    try {
      var msg = JSON.parse(event.data);
      if (msg.type === 'changePage') {
        var nav = document.querySelector('[role="navigation"]');
        if (!nav) return;
        nav.style.display = '';
        var targetIndex = msg.payload.index;
        var tocButton = nav.querySelector('[aria-label="Table of Contents"]');
        if (tocButton) {
          tocButton.click();
          setTimeout(function() {
            var menuItems = document.querySelectorAll('[role="menuitemradio"]');
            if (menuItems[targetIndex]) menuItems[targetIndex].click();
            setTimeout(extractAndHideTOC, 300);
          }, 100);
        } else {
          nav.style.display = 'none';
        }
      }
    } catch(e) {}
  });

  var observer = new MutationObserver(function() { extractAndHideTOC(); });
  if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  extractAndHideTOC();
  setTimeout(extractAndHideTOC, 500);
  setTimeout(extractAndHideTOC, 1500);
})();
true;
`;

export default function DownloadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [isDownloading, setIsDownloading] = useState(false);
  const [contentPages, setContentPages] = useState<ContentPage[]>([]);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const { data: purchases = [] } = usePurchases();
  const router = useRouter();
  const { isLoading, accessToken } = useAuth();
  const webViewRef = useRef<BaseWebView>(null);

  const purchase = purchases.find((p) => p.url_redirect_token === id);
  const url = `${env.EXPO_PUBLIC_GUMROAD_URL}/d/${id}?display=mobile_app&access_token=${accessToken}&mobile_token=${env.EXPO_PUBLIC_MOBILE_TOKEN}`;

  const { pauseAudio, playAudio } = useAudioPlayerSync(webViewRef);
  const { bottom } = useSafeAreaInsets();

  const handlePageChange = useCallback((index: number) => {
    setActivePageIndex(index);
    webViewRef.current?.postMessage(JSON.stringify({ type: "changePage", payload: { index } }));
  }, []);

  const handleMessage = async (event: WebViewMessageEvent) => {
    const data = event.nativeEvent.data;
    try {
      const message = JSON.parse(data) as WebViewMessage;
      console.info("WebView message received:", message);

      if (message.type === "contentPages") {
        setContentPages(message.payload.pages);
        setActivePageIndex(message.payload.activeIndex);
        return;
      }

      if (message.type !== "click") {
        console.warn("Unknown message from webview:", message);
        return;
      }

      const fileData = purchase?.file_data?.find((f) => f.id === message.payload.resourceId);

      if (message.payload.extension === "PDF" && !message.payload.isDownload) {
        router.push({
          pathname: "/pdf-viewer",
          params: {
            uri: downloadUrl(id, message.payload.resourceId),
            title: purchase?.name,
            urlRedirectId: id,
            productFileId: message.payload.resourceId,
            purchaseId: purchase?.purchase_id,
            initialPage: message.payload.resumeAt,
          },
        });
        return;
      }
      if (message.payload.type === "audio" && !message.payload.isDownload) {
        if (message.payload.isPlaying === "true") {
          await pauseAudio();
        } else {
          await playAudio({
            uri: downloadUrl(id, message.payload.resourceId),
            resourceId: message.payload.resourceId,
            resumeAt: message.payload.resumeAt ? Number(message.payload.resumeAt) : undefined,
            title: fileData?.name ?? purchase?.name,
            artist: purchase?.creator_name,
            artwork: purchase?.thumbnail_url,
            urlRedirectId: id,
            purchaseId: purchase?.purchase_id,
            contentLength: message.payload.contentLength ? Number(message.payload.contentLength) : undefined,
          });
        }
        return;
      }
      if (fileData?.filegroup === "video" && !message.payload.isDownload) {
        router.push({
          pathname: "/video-player",
          params: {
            uri: downloadUrl(id, message.payload.resourceId),
            streamingUrl: purchase?.file_data?.find((f) => f.id === message.payload.resourceId)?.streaming_url,
            title: purchase?.name,
            urlRedirectId: id,
            productFileId: message.payload.resourceId,
            purchaseId: purchase?.purchase_id,
            initialPosition: message.payload.resumeAt ?? undefined,
          },
        });
        return;
      }

      setIsDownloading(true);
      const downloadedFile = await downloadFile(id, message.payload.resourceId);
      await shareFile(downloadedFile.uri);
    } catch (error) {
      console.error("Download failed:", error, data);
      Alert.alert("Download Failed", error instanceof Error ? error.message : "Failed to download file");
    } finally {
      setIsDownloading(false);
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-body-bg">
        <LoadingSpinner size="large" />
      </View>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: purchase?.name ?? "" }} />
      <StyledWebView
        ref={webViewRef}
        source={{ uri: url }}
        className="flex-1 bg-transparent"
        webviewDebuggingEnabled
        pullToRefreshEnabled
        mediaPlaybackRequiresUserAction={false}
        originWhitelist={["*"]}
        onMessage={handleMessage}
        injectedJavaScript={INJECTED_JS}
      />
      {isDownloading && (
        <View className="absolute inset-0 items-center justify-center bg-black/50">
          <LoadingSpinner size="large" />
        </View>
      )}
      <View className="bg-body-bg" style={{ paddingBottom: bottom }}>
        <ContentPagesFooter pages={contentPages} activeIndex={activePageIndex} onPageChange={handlePageChange} />
        <MiniAudioPlayer />
      </View>
    </Screen>
  );
}
