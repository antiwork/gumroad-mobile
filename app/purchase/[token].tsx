import { ContentPageNav, TocPage } from "@/components/content-page-nav";
import { usePurchase } from "@/components/library/use-purchases";
import { MiniAudioPlayer } from "@/components/mini-audio-player";
import { StyledWebView } from "@/components/styled";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Screen } from "@/components/ui/screen";
import { useAddRecentPurchase } from "@/components/library/use-recent-products";
import { useAudioPlayerSync } from "@/components/use-audio-player-sync";
import { useAuth } from "@/lib/auth-context";
import { env } from "@/lib/env";
import { buildApiUrl } from "@/lib/request";
import { File, Paths } from "expo-file-system";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { useCallback, useEffect, useRef, useState } from "react";
import * as Sentry from "@sentry/react-native";
import { Alert, Linking, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView as BaseWebView, WebViewMessageEvent } from "react-native-webview";

const WEBVIEW_ALLOWED_DOMAINS = [
  "https://challenges.cloudflare.com/",
  "https://connect-js.stripe.com/",
  "https://cdn.iframe.ly/",
];

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

  const { pauseAudio, playAudio } = useAudioPlayerSync(webViewRef);
  const { bottom } = useSafeAreaInsets();

  useEffect(() => {
    if (purchase) addRecentPurchase(purchase);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchase?.unique_permalink]);

  const handleShouldStartLoadWithRequest = useCallback(
    (request: { url: string; navigationType: string }) => {
      if (
        request.url === url ||
        request.url.startsWith(env.EXPO_PUBLIC_GUMROAD_URL) ||
        !WEBVIEW_ALLOWED_DOMAINS.some((domain) => request.url.startsWith(domain)) ||
        !/^https?:\/\//.test(request.url)
      )
        return true;
      Linking.openURL(request.url);
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
            uri: downloadUrl(token, message.payload.resourceId),
            title: purchase?.name,
            urlRedirectId: purchase?.url_redirect_external_id,
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
          const allAudioFiles = purchase?.file_data?.filter((fileData) => fileData.filegroup === "audio") ?? [];
          const allAudioTracks = allAudioFiles.map((fileData) => ({
            uri: downloadUrl(token, fileData.id),
            resourceId: fileData.id,
            title: fileData.name ?? purchase?.name,
            urlRedirectId: purchase?.url_redirect_external_id,
            purchaseId: purchase?.purchase_id,
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
            uri: downloadUrl(token, message.payload.resourceId),
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
      const downloadedFile = await downloadFile(token, message.payload.resourceId);
      await shareFile(downloadedFile.uri);
    } catch (error) {
      console.error("Download failed:", error, data);
      Sentry.captureException(error);
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
        incognito
        mediaPlaybackRequiresUserAction={false}
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
