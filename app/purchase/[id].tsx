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
import { File, Paths } from "expo-file-system";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { useCallback, useRef, useState } from "react";
import { Alert, FlatList, TouchableOpacity, View } from "react-native";
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

type ContentNavigationPage = {
  id: string;
  title: string;
  isActive: boolean;
};

type ContentNavigationState = {
  visible: boolean;
  pages: ContentNavigationPage[];
  activeIndex: number;
  canGoPrevious: boolean;
  canGoNext: boolean;
};

type ContentNavigationCommand =
  | { action: "previous" | "next" | "requestState" }
  | { action: "goToIndex"; index: number };

const CONTENT_NAVIGATION_COMMAND_TYPE = "mobileContentNavigationCommand";

const CONTENT_NAVIGATION_BRIDGE_SCRIPT = `
(function () {
  if (window.__gumroadMobileContentNavigationBridgeInstalled) return;
  window.__gumroadMobileContentNavigationBridgeInstalled = true;

  var STATE_MESSAGE_TYPE = "contentNavigationState";
  var COMMAND_MESSAGE_TYPE = "mobileContentNavigationCommand";
  var HIDDEN_ATTR = "data-native-navigation-hidden";
  var lastSerializedState = "";

  function postToNative(payload) {
    if (!window.ReactNativeWebView || typeof window.ReactNativeWebView.postMessage !== "function") return;
    window.ReactNativeWebView.postMessage(JSON.stringify(payload));
  }

  function textContent(el) {
    return el && typeof el.textContent === "string" ? el.textContent.trim() : "";
  }

  function normalize(text) {
    return textContent(text).toLowerCase();
  }

  function isNavigationRoot(el) {
    var text = normalize(el);
    return text.indexOf("previous") !== -1 && text.indexOf("next") !== -1;
  }

  function findNavigationRoot() {
    var candidates = Array.prototype.slice.call(document.querySelectorAll('div[role="navigation"]'));
    for (var i = 0; i < candidates.length; i += 1) {
      if (isNavigationRoot(candidates[i])) return candidates[i];
    }
    return null;
  }

  function findButtons(root) {
    if (!root) return { tocButton: null, previousButton: null, nextButton: null };
    var buttons = Array.prototype.slice.call(root.querySelectorAll("button"));
    var tocButton = null;
    var previousButton = null;
    var nextButton = null;
    for (var i = 0; i < buttons.length; i += 1) {
      var button = buttons[i];
      var aria = (button.getAttribute("aria-label") || "").toLowerCase();
      var text = normalize(button);
      if (!tocButton && (aria.indexOf("table of contents") !== -1 || text.indexOf("contents") !== -1)) tocButton = button;
      if (!previousButton && text.indexOf("previous") !== -1) previousButton = button;
      if (!nextButton && text.indexOf("next") !== -1) nextButton = button;
    }
    return { tocButton: tocButton, previousButton: previousButton, nextButton: nextButton };
  }

  function readPages() {
    var pageItems = Array.prototype.slice.call(document.querySelectorAll('[role="menuitemradio"], [role="tab"]'));
    var pages = [];
    for (var i = 0; i < pageItems.length; i += 1) {
      var item = pageItems[i];
      var title = textContent(item);
      if (!title) continue;
      pages.push({
        id: item.getAttribute("data-page-id") || item.id || "page-" + i,
        title: title,
        isActive: item.getAttribute("aria-checked") === "true" || item.getAttribute("aria-selected") === "true",
      });
    }
    return pages;
  }

  function clickElement(element) {
    if (!element || element.disabled) return false;
    element.click();
    return true;
  }

  function syncState(force) {
    var root = findNavigationRoot();
    if (root && !root.getAttribute(HIDDEN_ATTR)) {
      root.style.display = "none";
      root.setAttribute(HIDDEN_ATTR, "true");
    }

    var buttons = findButtons(root);
    var pages = readPages();
    var activeIndex = -1;
    for (var i = 0; i < pages.length; i += 1) {
      if (pages[i].isActive) {
        activeIndex = i;
        break;
      }
    }
    if (activeIndex < 0) activeIndex = 0;

    var payload = {
      visible: !!root,
      pages: pages,
      activeIndex: activeIndex,
      canGoPrevious: !!(buttons.previousButton && !buttons.previousButton.disabled),
      canGoNext: !!(buttons.nextButton && !buttons.nextButton.disabled),
    };

    var serialized = JSON.stringify(payload);
    if (force || serialized !== lastSerializedState) {
      lastSerializedState = serialized;
      postToNative({ type: STATE_MESSAGE_TYPE, payload: payload });
    }
  }

  function clickPageAtIndex(index) {
    var items = Array.prototype.slice.call(document.querySelectorAll('[role="menuitemradio"], [role="tab"]'));
    if (index < 0 || index >= items.length) return false;
    return clickElement(items[index]);
  }

  function handleCommand(payload) {
    if (!payload || typeof payload.action !== "string") return;
    var root = findNavigationRoot();
    var buttons = findButtons(root);

    if (payload.action === "previous") {
      clickElement(buttons.previousButton);
      setTimeout(function () {
        syncState(false);
      }, 50);
      return;
    }

    if (payload.action === "next") {
      clickElement(buttons.nextButton);
      setTimeout(function () {
        syncState(false);
      }, 50);
      return;
    }

    if (payload.action === "goToIndex" && typeof payload.index === "number") {
      if (!clickPageAtIndex(payload.index) && buttons.tocButton) {
        clickElement(buttons.tocButton);
        setTimeout(function () {
          clickPageAtIndex(payload.index);
          setTimeout(function () {
            syncState(false);
          }, 75);
        }, 75);
        return;
      }
      setTimeout(function () {
        syncState(false);
      }, 50);
      return;
    }

    if (payload.action === "requestState") {
      syncState(true);
    }
  }

  function parseIncoming(data) {
    if (typeof data !== "string" || data.charAt(0) !== "{") return null;
    try {
      return JSON.parse(data);
    } catch (_err) {
      return null;
    }
  }

  function onMessage(event) {
    var message = parseIncoming(event.data);
    if (!message || message.type !== COMMAND_MESSAGE_TYPE) return;
    handleCommand(message.payload || null);
  }

  if (window.addEventListener) window.addEventListener("message", onMessage);
  if (document.addEventListener) document.addEventListener("message", onMessage);

  var observer = new MutationObserver(function () {
    syncState(false);
  });
  observer.observe(document.documentElement || document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["aria-disabled", "aria-checked", "aria-selected", "disabled", "class"],
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      syncState(true);
    });
  } else {
    syncState(true);
  }
  window.addEventListener("load", function () {
    syncState(true);
  });
  setTimeout(function () {
    syncState(true);
  }, 300);
})();
true;
`;

const DEFAULT_CONTENT_NAVIGATION_STATE: ContentNavigationState = {
  visible: false,
  pages: [],
  activeIndex: 0,
  canGoPrevious: false,
  canGoNext: false,
};

const toObject = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;

const toNumber = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const toBoolean = (value: unknown, fallback: boolean) => (typeof value === "boolean" ? value : fallback);

const normalizeNavigationState = (payload: unknown): ContentNavigationState | null => {
  const state = toObject(payload);
  if (!state) return null;

  const rawPages = Array.isArray(state.pages)
    ? state.pages
    : Array.isArray(state.tableOfContents)
      ? state.tableOfContents
      : [];

  const pages = rawPages
    .map((page, index) => {
      const parsed = toObject(page);
      if (!parsed) return null;

      const title = typeof parsed.title === "string" && parsed.title.trim() ? parsed.title.trim() : `Page ${index + 1}`;
      const id =
        typeof parsed.id === "string" && parsed.id.trim()
          ? parsed.id
          : typeof parsed.pageId === "string" && parsed.pageId.trim()
            ? parsed.pageId
            : `page-${index}`;

      return {
        id,
        title,
        isActive: toBoolean(parsed.isActive ?? parsed.active ?? parsed.is_active, false),
      };
    })
    .filter((page): page is ContentNavigationPage => page !== null);

  const activeIndexFromPayload = toNumber(state.activeIndex ?? state.active_index, -1);
  const activeIndexFromPages = pages.findIndex((page) => page.isActive);
  const unclampedActiveIndex =
    activeIndexFromPayload >= 0 ? activeIndexFromPayload : activeIndexFromPages >= 0 ? activeIndexFromPages : 0;
  const maxIndex = Math.max(0, pages.length - 1);
  const activeIndex = Math.max(0, Math.min(unclampedActiveIndex, maxIndex));

  const canGoPrevious = toBoolean(
    state.canGoPrevious ?? state.can_go_previous ?? state.hasPreviousPage ?? state.has_previous_page,
    activeIndex > 0,
  );
  const canGoNext = toBoolean(
    state.canGoNext ?? state.can_go_next ?? state.hasNextPage ?? state.has_next_page,
    activeIndex < maxIndex,
  );
  const visible = toBoolean(state.visible, pages.length > 1 || canGoPrevious || canGoNext);

  return {
    visible,
    pages,
    activeIndex,
    canGoPrevious,
    canGoNext,
  };
};

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

export default function DownloadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [isDownloading, setIsDownloading] = useState(false);
  const [showTocSheet, setShowTocSheet] = useState(false);
  const [contentNavigation, setContentNavigation] = useState<ContentNavigationState>(DEFAULT_CONTENT_NAVIGATION_STATE);
  const { data: purchases = [] } = usePurchases();
  const router = useRouter();
  const { isLoading, accessToken } = useAuth();
  const webViewRef = useRef<BaseWebView>(null);

  const purchase = purchases.find((p) => p.url_redirect_token === id);
  const url = `${env.EXPO_PUBLIC_GUMROAD_URL}/d/${id}?display=mobile_app&access_token=${accessToken}&mobile_token=${env.EXPO_PUBLIC_MOBILE_TOKEN}`;

  const { pauseAudio, playAudio } = useAudioPlayerSync(webViewRef);
  const { bottom } = useSafeAreaInsets();

  const sendContentNavigationCommand = useCallback((payload: ContentNavigationCommand) => {
    webViewRef.current?.postMessage(
      JSON.stringify({
        type: CONTENT_NAVIGATION_COMMAND_TYPE,
        payload,
      }),
    );
  }, []);

  const handleWebViewLoadEnd = useCallback(() => {
    sendContentNavigationCommand({ action: "requestState" });
  }, [sendContentNavigationCommand]);

  const handleMessage = async (event: WebViewMessageEvent) => {
    const data = event.nativeEvent.data;
    const parsed = toObject((() => {
      try {
        return JSON.parse(data) as unknown;
      } catch {
        return null;
      }
    })());
    if (!parsed || typeof parsed.type !== "string") return;

    if (
      parsed.type === "contentNavigationState" ||
      parsed.type === "mobileContentNavigationState" ||
      parsed.type === "content_navigation_state"
    ) {
      const nextState = normalizeNavigationState(parsed.payload);
      if (nextState) setContentNavigation(nextState);
      return;
    }

    if (parsed.type !== "click") {
      console.warn("Unknown message from webview:", parsed);
      return;
    }

    const message = parsed as ClickMessage;
    if (!message.payload || typeof message.payload.resourceId !== "string") {
      console.warn("Invalid click payload from webview:", message);
      return;
    }

    try {
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
        injectedJavaScriptBeforeContentLoaded={CONTENT_NAVIGATION_BRIDGE_SCRIPT}
        pullToRefreshEnabled
        mediaPlaybackRequiresUserAction={false}
        originWhitelist={["*"]}
        onLoadEnd={handleWebViewLoadEnd}
        onMessage={handleMessage}
      />
      {isDownloading && (
        <View className="absolute inset-0 items-center justify-center bg-black/50">
          <LoadingSpinner size="large" />
        </View>
      )}
      {contentNavigation.visible && (
        <View className="border-t border-border bg-body-bg px-4 py-3">
          <View className="flex-row gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onPress={() => {
                sendContentNavigationCommand({ action: "requestState" });
                setShowTocSheet(true);
              }}
              disabled={contentNavigation.pages.length === 0}
            >
              <LineIcon name="list-ul" size={18} className="text-foreground" />
              <Text>Contents</Text>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              disabled={!contentNavigation.canGoPrevious}
              onPress={() => sendContentNavigationCommand({ action: "previous" })}
            >
              <LineIcon name="chevron-left" size={18} className="text-foreground" />
              <Text>Previous</Text>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              disabled={!contentNavigation.canGoNext}
              onPress={() => sendContentNavigationCommand({ action: "next" })}
            >
              <Text>Next</Text>
              <LineIcon name="chevron-right" size={18} className="text-foreground" />
            </Button>
          </View>
        </View>
      )}
      <View className="bg-body-bg" style={{ paddingBottom: bottom }}>
        <MiniAudioPlayer />
      </View>

      <Sheet open={showTocSheet} onOpenChange={setShowTocSheet}>
        <SheetHeader onClose={() => setShowTocSheet(false)}>
          <SheetTitle>Table of Contents</SheetTitle>
        </SheetHeader>
        <SheetContent>
          <FlatList
            data={contentNavigation.pages}
            keyExtractor={(item, index) => `${item.id}-${index}`}
            renderItem={({ item, index }) => (
              <TouchableOpacity
                onPress={() => {
                  sendContentNavigationCommand({ action: "goToIndex", index });
                  setShowTocSheet(false);
                }}
              >
                <View className="flex-row items-center border-b border-border px-4 py-3">
                  <Text className="flex-1 text-base text-foreground" numberOfLines={2}>
                    {item.title}
                  </Text>
                  {index === contentNavigation.activeIndex && (
                    <LineIcon name="check" size={18} className="text-accent" />
                  )}
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View className="items-center justify-center p-8">
                <Text className="text-muted">No table of contents available</Text>
              </View>
            }
          />
        </SheetContent>
      </Sheet>
    </Screen>
  );
}
