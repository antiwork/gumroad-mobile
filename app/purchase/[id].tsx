import { usePurchases } from "@/app/(tabs)/library";
import { LineIcon } from "@/components/icon";
import { MiniAudioPlayer } from "@/components/mini-audio-player";
import { StyledWebView } from "@/components/styled";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Screen } from "@/components/ui/screen";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Text } from "@/components/ui/text";
import { useAudioPlayerSync } from "@/components/use-audio-player-sync";
import { useAuth } from "@/lib/auth-context";
import { env } from "@/lib/env";
import { buildApiUrl } from "@/lib/request";
import { cn } from "@/lib/utils";
import { File, Paths } from "expo-file-system";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { useRef, useState } from "react";
import { Alert, ScrollView, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView as BaseWebView, WebViewMessageEvent } from "react-native-webview";

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

type TocItem = {
  id: string;
  title: string;
};

type TocStatePayload = {
  items: TocItem[];
  currentIndex: number;
  hasNext: boolean;
  hasPrev: boolean;
};

type WebMessage =
  | { type: "click"; payload: ClickPayload }
  | { type: "toc_state"; payload: TocStatePayload };

const ICON_SIZE_CHEVRON = 20;
const ICON_SIZE_LIST = 16;

const TOC_BRIDGE_JS = `
(function() {
  if (window.__tocBridgeInitialized) return;
  window.__tocBridgeInitialized = true;

  var NAV_SELECTORS = [
    '[role="navigation"]',
    '.content-page-navigation',
    'nav[class*="page"]'
  ];

  function findNavElement() {
    for (var i = 0; i < NAV_SELECTORS.length; i++) {
      var el = document.querySelector(NAV_SELECTORS[i]);
      if (el) return el;
    }
    return null;
  }

  function hideNavElement() {
    var nav = findNavElement();
    if (nav) nav.style.display = 'none';
    return nav;
  }

  function extractTocState() {
    var nav = findNavElement();
    if (!nav) return null;

    var buttons = nav.querySelectorAll('button, a[role="button"], [data-page]');
    var pageButtons = [];
    var currentIndex = -1;

    buttons.forEach(function(btn, idx) {
      var text = (btn.textContent || '').trim();
      var isNavBtn = /^(previous|next|prev|←|→)/i.test(text);
      if (isNavBtn || !text) return;

      var isCurrent = btn.getAttribute('aria-current') === 'page'
        || btn.classList.contains('active')
        || btn.getAttribute('data-active') === 'true'
        || btn.getAttribute('aria-selected') === 'true';

      pageButtons.push({ el: btn, title: text });
      if (isCurrent) currentIndex = pageButtons.length - 1;
    });

    if (pageButtons.length <= 1) {
      var popoverTrigger = nav.querySelector('[data-popover-trigger], [aria-haspopup]');
      if (popoverTrigger) {
        popoverTrigger.click();
        setTimeout(function() {
          var listItems = document.querySelectorAll('[role="menu"] [role="menuitem"], [data-popover] button, [data-popover] a');
          var popoverButtons = [];
          var popCurrentIndex = -1;
          listItems.forEach(function(item) {
            var itemText = (item.textContent || '').trim();
            if (!itemText) return;
            var isActive = item.classList.contains('active')
              || item.getAttribute('aria-current') === 'page'
              || item.getAttribute('data-active') === 'true';
            popoverButtons.push({ el: item, title: itemText });
            if (isActive) popCurrentIndex = popoverButtons.length - 1;
          });
          if (popoverButtons.length > 1) {
            window.__tocPageButtons = popoverButtons;
            if (popCurrentIndex === -1) popCurrentIndex = 0;
            sendTocState(popoverButtons, popCurrentIndex);
          }
          popoverTrigger.click();
        }, 100);
        return 'deferred';
      }
      return null;
    }

    window.__tocPageButtons = pageButtons;
    if (currentIndex === -1) currentIndex = 0;
    return { buttons: pageButtons, currentIndex: currentIndex };
  }

  function sendTocState(pageButtons, currentIndex) {
    var items = pageButtons.map(function(p, i) {
      return { id: String(i), title: p.title };
    });
    var payload = {
      type: 'toc_state',
      payload: {
        items: items,
        currentIndex: currentIndex,
        hasNext: currentIndex < items.length - 1,
        hasPrev: currentIndex > 0
      }
    };
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(payload));
    }
  }

  function handleExtraction() {
    var result = extractTocState();
    if (result && result !== 'deferred') {
      hideNavElement();
      sendTocState(result.buttons, result.currentIndex);
    } else if (result === null) {
      hideNavElement();
    }
  }

  window.addEventListener('native_navigate_toc', function(e) {
    var index = e.detail && e.detail.index;
    if (typeof index !== 'number' || !window.__tocPageButtons) return;
    var target = window.__tocPageButtons[index];
    if (target && target.el) {
      target.el.click();
      setTimeout(handleExtraction, 300);
    }
  });

  var observer = new MutationObserver(function() {
    hideNavElement();
    setTimeout(handleExtraction, 200);
  });

  function init() {
    handleExtraction();
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(init, 500);
  } else {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(init, 500); });
  }
})();
true;
`;

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

const DownloadScreen = () => {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [isDownloading, setIsDownloading] = useState(false);
  const [tocState, setTocState] = useState<TocStatePayload | null>(null);
  const [isTocSheetOpen, setTocSheetOpen] = useState(false);
  const { data: purchases = [] } = usePurchases();
  const router = useRouter();
  const { isLoading, accessToken } = useAuth();
  const webViewRef = useRef<BaseWebView>(null);

  const purchase = purchases.find((p) => p.url_redirect_token === id);
  const url = `${env.EXPO_PUBLIC_GUMROAD_URL}/d/${id}?display=mobile_app&access_token=${accessToken}&mobile_token=${env.EXPO_PUBLIC_MOBILE_TOKEN}`;

  const { pauseAudio, playAudio } = useAudioPlayerSync(webViewRef);
  const { bottom } = useSafeAreaInsets();

  const navigateToPage = (index: number) => {
    webViewRef.current?.injectJavaScript(
      `window.dispatchEvent(new CustomEvent('native_navigate_toc', { detail: { index: ${index} } })); true;`,
    );
    setTocSheetOpen(false);
  };

  const handleMessage = async (event: WebViewMessageEvent) => {
    const data = event.nativeEvent.data;
    try {
      const message = JSON.parse(data) as WebMessage;
      console.info("WebView message received:", message);

      if (message.type === "toc_state") {
        setTocState(message.payload);
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
        injectedJavaScript={TOC_BRIDGE_JS}
      />
      {isDownloading && (
        <View className="absolute inset-0 items-center justify-center bg-black/50">
          <LoadingSpinner size="large" />
        </View>
      )}
      {tocState && tocState.items.length > 1 && (
        <View className="flex-row items-center justify-between border-t border-border bg-background px-4 py-3">
          <TouchableOpacity
            onPress={() => navigateToPage(tocState.currentIndex - 1)}
            disabled={!tocState.hasPrev}
            className={cn("flex-row items-center gap-1", !tocState.hasPrev && "opacity-30")}
          >
            <LineIcon name="chevron-left" size={ICON_SIZE_CHEVRON} className="text-foreground" />
            <Text className="text-sm text-foreground">Prev</Text>
          </TouchableOpacity>
          <Button variant="outline" size="sm" onPress={() => setTocSheetOpen(true)}>
            <LineIcon name="list-ul" size={ICON_SIZE_LIST} className="text-foreground" />
            <Text>Contents</Text>
          </Button>
          <TouchableOpacity
            onPress={() => navigateToPage(tocState.currentIndex + 1)}
            disabled={!tocState.hasNext}
            className={cn("flex-row items-center gap-1", !tocState.hasNext && "opacity-30")}
          >
            <Text className="text-sm text-foreground">Next</Text>
            <LineIcon name="chevron-right" size={ICON_SIZE_CHEVRON} className="text-foreground" />
          </TouchableOpacity>
        </View>
      )}
      <View className="bg-body-bg" style={{ paddingBottom: bottom }}>
        <MiniAudioPlayer />
      </View>
      <Sheet open={isTocSheetOpen} onOpenChange={setTocSheetOpen}>
        <SheetContent>
          <SheetHeader onClose={() => setTocSheetOpen(false)}>
            <SheetTitle>Contents</SheetTitle>
          </SheetHeader>
          <ScrollView>
            {tocState?.items.map((item, index) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => navigateToPage(index)}
                className={cn("border-b border-border p-4", index === tocState.currentIndex && "bg-muted/50")}
              >
                <Text
                  className={cn(
                    "font-sans text-base",
                    index === tocState.currentIndex ? "font-bold text-accent" : "text-foreground",
                  )}
                >
                  {item.title}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </SheetContent>
      </Sheet>
    </Screen>
  );
};

export default DownloadScreen;
