import { ContentPageNav, TocPage } from "@/components/content-page-nav";
import { fetchPurchaseDetail, usePurchase } from "@/components/library/use-purchases";
import { MiniAudioPlayer } from "@/components/mini-audio-player";
import { StyledWebView } from "@/components/styled";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Screen } from "@/components/ui/screen";
import { useAddRecentPurchase } from "@/components/library/use-recent-products";
import { useAudioPlayerSync } from "@/components/use-audio-player-sync";
import { assertDefined } from "@/lib/assert";
import { useAuth } from "@/lib/auth-context";
import { productFileDownloadUrl } from "@/lib/download-url";
import { env } from "@/lib/env";
import { cacheFileDestination, downloadFileWithRetry, FileUnavailableError } from "@/lib/file-utils";
import { safeOpenURL } from "@/lib/open-url";
import { shareFile } from "@/lib/share";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import * as Sentry from "@sentry/react-native";
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

type TocDataMessage = {
  type: "tocData";
  payload: {
    pages: TocPage[];
    activePageIndex: number;
  };
};

const webViewInternalSchemes = ["about:", "data:", "blob:", "javascript:"];

const isWebViewInternalUrl = (url: string) => {
  const lower = url.toLowerCase();
  return webViewInternalSchemes.some((scheme) => lower.startsWith(scheme));
};

export default function DownloadScreen() {
  const { token, urlRedirectExternalId } = useLocalSearchParams<{ token: string; urlRedirectExternalId: string }>();
  const [isDownloading, setIsDownloading] = useState(false);
  const [tocPages, setTocPages] = useState<TocDataMessage["payload"]["pages"]>([]);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const purchase = usePurchase(urlRedirectExternalId);
  const addRecentPurchase = useAddRecentPurchase();
  const router = useRouter();
  const { isLoading, accessToken } = useAuth();
  const webViewRef = useRef<BaseWebView>(null);
  const url = `${env.EXPO_PUBLIC_GUMROAD_URL}/d/${token}?display=mobile_app&access_token=${accessToken}&mobile_token=${env.EXPO_PUBLIC_MOBILE_TOKEN}`;

  const { pauseAudio, playAudio, activeResourceId, isPlaying } = useAudioPlayerSync(webViewRef);
  const { bottom } = useSafeAreaInsets();

  // Download URLs embed the url_redirect token, which can go stale by the time the user taps a
  // file (for example after the app sat backgrounded). Refetching the purchase yields a current
  // token to rebuild the URL from.
  const refreshDownloadUrl = useCallback(
    async (productFileId: string) => {
      const detail = await fetchPurchaseDetail(assertDefined(urlRedirectExternalId), assertDefined(accessToken));
      return productFileDownloadUrl(detail.product.url_redirect_token, productFileId);
    },
    [urlRedirectExternalId, accessToken],
  );

  const downloadFile = (productFileId: string, fileName: string) =>
    downloadFileWithRetry(productFileDownloadUrl(token, productFileId), cacheFileDestination(productFileId, fileName), {
      refreshUrl: () => refreshDownloadUrl(productFileId),
    });

  useEffect(() => {
    if (purchase) addRecentPurchase(purchase);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchase?.unique_permalink]);

  const handleShouldStartLoadWithRequest = useCallback(
    (request: { url: string; navigationType: string; mainDocumentURL?: string }) => {
      // Allow loading iframes, e.g. video embeds
      if (request.mainDocumentURL && request.url !== request.mainDocumentURL) return true;
      if (
        request.url === url ||
        request.url.startsWith(env.EXPO_PUBLIC_GUMROAD_URL) ||
        request.url.startsWith("https://challenges.cloudflare.com/") ||
        request.url.startsWith("https://connect-js.stripe.com/") ||
        isWebViewInternalUrl(request.url)
      )
        return true;
      safeOpenURL(request.url);
      return false;
    },
    [url],
  );

  const handleNativePageChange = useCallback((pageIndex: number) => {
    webViewRef.current?.postMessage(JSON.stringify({ type: "mobileAppPageChange", payload: { pageIndex } }));
  }, []);

  const handleMessage = async (event: WebViewMessageEvent) => {
    const data = event.nativeEvent.data;
    try {
      const message = JSON.parse(data) as ClickMessage | TocDataMessage;
      console.info("WebView message received:", message);

      if (message.type === "tocData") {
        const pages = message.payload.pages;
        setTocPages(pages);
        setActivePageIndex(Math.min(message.payload.activePageIndex, Math.max(pages.length - 1, 0)));
        return;
      }

      if (message.type !== "click") {
        console.warn("Unknown message from webview:", message);
        return;
      }

      const fileData = purchase?.file_data?.find((f) => f.id === message.payload.resourceId);

      if (message.payload.isPost) {
        router.push({
          pathname: "/post/[id]",
          params: {
            id: message.payload.resourceId,
            purchaseId: purchase?.purchase_id,
          },
        });
        return;
      }

      if (message.payload.extension === "PDF" && !message.payload.isDownload) {
        router.push({
          pathname: "/pdf-viewer",
          params: {
            uri: productFileDownloadUrl(token, message.payload.resourceId),
            title: purchase?.name,
            fileName: fileData?.name,
            urlRedirectId: purchase?.url_redirect_external_id,
            productFileId: message.payload.resourceId,
            purchaseId: purchase?.purchase_id,
            initialPage: fileData?.latest_media_location?.location ?? message.payload.resumeAt,
          },
        });
        return;
      }
      if (message.payload.type === "audio" && !message.payload.isDownload) {
        // The web row's isPlaying claim can go stale (it only receives player-info messages for
        // the current track, so a row left behind by auto-advance or track end still claims to
        // be playing). Trust the native player's state instead of the row's.
        if (message.payload.resourceId === activeResourceId && isPlaying) {
          await pauseAudio();
        } else {
          const allAudioFiles = purchase?.file_data?.filter((fileData) => fileData.filegroup === "audio") ?? [];
          const allAudioTracks = allAudioFiles.map((fileData) => ({
            uri: productFileDownloadUrl(token, fileData.id),
            resourceId: fileData.id,
            title: fileData.name ?? purchase?.name,
            urlRedirectId: purchase?.url_redirect_external_id,
            purchaseId: purchase?.purchase_id,
            resumeAt: fileData.latest_media_location?.location,
            contentLength: fileData.content_length,
          }));
          await playAudio({
            resourceId: message.payload.resourceId,
            resumeAt: message.payload.resumeAt ? Number(message.payload.resumeAt) : undefined,
            artist: purchase?.creator_name,
            artistUrl: purchase?.creator_profile_url,
            artwork: purchase?.thumbnail_url,
            tracks: allAudioTracks,
          });
        }
        return;
      }
      if (fileData?.filegroup === "video" && !message.payload.isDownload) {
        router.push({
          pathname: "/video-player",
          params: {
            uri: productFileDownloadUrl(token, message.payload.resourceId),
            streamingUrl: purchase?.file_data?.find((f) => f.id === message.payload.resourceId)?.streaming_url,
            title: purchase?.name,
            urlRedirectId: purchase?.url_redirect_external_id,
            productFileId: message.payload.resourceId,
            purchaseId: purchase?.purchase_id,
            initialPosition: message.payload.resumeAt ?? undefined,
          },
        });
        return;
      }

      setIsDownloading(true);
      const fallbackName = message.payload.extension
        ? `${message.payload.resourceId}.${message.payload.extension.toLowerCase()}`
        : message.payload.resourceId;
      const downloadedFile = await downloadFile(message.payload.resourceId, fileData?.name ?? fallbackName);
      await shareFile(downloadedFile.uri);
    } catch (error) {
      console.error("Download failed:", error, data);
      if (!(error instanceof FileUnavailableError)) Sentry.captureException(error);
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
        key={accessToken ?? "anonymous"}
        ref={webViewRef}
        source={{ uri: url }}
        className="flex-1 bg-transparent"
        webviewDebuggingEnabled
        pullToRefreshEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        mediaPlaybackRequiresUserAction={false}
        // Android blocks the HTML5 fullscreen API in WebViews unless this is enabled, so videos playing inline (like embedded players in rich content) would have a fullscreen button that does nothing. iOS ignores this prop.
        allowsFullscreenVideo
        originWhitelist={["*"]}
        onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
        onMessage={handleMessage}
      />
      {isDownloading && (
        <View className="absolute inset-0 items-center justify-center bg-black/50">
          <LoadingSpinner size="large" />
        </View>
      )}
      <View className="bg-body-bg">
        <MiniAudioPlayer />
      </View>
      {tocPages.length > 0 && (
        <ContentPageNav pages={tocPages} activePageIndex={activePageIndex} onPageChange={handleNativePageChange} />
      )}
      <View style={{ paddingBottom: bottom }} />
    </Screen>
  );
}
