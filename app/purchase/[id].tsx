import { usePurchases } from "@/app/(tabs)/library";
import { MiniAudioPlayer } from "@/components/mini-audio-player";
import { PurchaseContentNavigationFooter } from "@/components/purchase-content-navigation-footer";
import { StyledWebView } from "@/components/styled";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Screen } from "@/components/ui/screen";
import { useAudioPlayerSync } from "@/components/use-audio-player-sync";
import { useAuth } from "@/lib/auth-context";
import { env } from "@/lib/env";
import {
  CONTENT_PAGE_NAVIGATION_STATE_MESSAGE_TYPE,
  createContentPageNavigationCommandMessage,
  DEFAULT_CONTENT_PAGE_NAVIGATION_STATE,
  parsePurchaseWebViewMessage,
  purchaseContentNavigationBridgeScript,
  type ClickMessage,
  type MobileAppContentPageNavigationCommandAction,
} from "@/lib/purchase-content-navigation";
import { buildApiUrl } from "@/lib/request";
import { File, Paths } from "expo-file-system";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { useRef, useState } from "react";
import { Alert, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView as BaseWebView, WebViewMessageEvent } from "react-native-webview";

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
  const [contentPageNavigationState, setContentPageNavigationState] = useState(DEFAULT_CONTENT_PAGE_NAVIGATION_STATE);
  const { data: purchases = [] } = usePurchases();
  const router = useRouter();
  const { isLoading, accessToken } = useAuth();
  const webViewRef = useRef<BaseWebView>(null);

  const purchase = purchases.find((p) => p.url_redirect_token === id);
  const url = `${env.EXPO_PUBLIC_GUMROAD_URL}/d/${id}?display=mobile_app&access_token=${accessToken}&mobile_token=${env.EXPO_PUBLIC_MOBILE_TOKEN}`;

  const { pauseAudio, playAudio } = useAudioPlayerSync(webViewRef);
  const { bottom } = useSafeAreaInsets();

  const postContentPageNavigationCommand = (action: MobileAppContentPageNavigationCommandAction) => {
    webViewRef.current?.postMessage(createContentPageNavigationCommandMessage(action));
  };

  const handleClickMessage = async (message: ClickMessage) => {
    const fileData = purchase?.file_data?.find((f) => f.id === message.payload.resourceId);

    try {
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
    } catch (error) {
      console.error("Download failed:", error, message);
      Alert.alert("Download failed", error instanceof Error ? error.message : "Failed to download file");
      return;
    }

    setIsDownloading(true);
    try {
      const downloadedFile = await downloadFile(id, message.payload.resourceId);
      await shareFile(downloadedFile.uri);
    } catch (error) {
      console.error("Download failed:", error, message);
      Alert.alert("Download failed", error instanceof Error ? error.message : "Failed to download file");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleMessage = async (event: WebViewMessageEvent) => {
    const data = event.nativeEvent.data;
    const message = parsePurchaseWebViewMessage(data);

    if (!message) {
      console.warn("Unknown message from webview:", data);
      return;
    }

    if (message.type === CONTENT_PAGE_NAVIGATION_STATE_MESSAGE_TYPE) {
      setContentPageNavigationState(message.payload);
      return;
    }

    await handleClickMessage(message);
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
        injectedJavaScriptBeforeContentLoaded={purchaseContentNavigationBridgeScript}
        pullToRefreshEnabled
        mediaPlaybackRequiresUserAction={false}
        originWhitelist={["*"]}
        onMessage={handleMessage}
      />
      {isDownloading && (
        <View className="absolute inset-0 items-center justify-center bg-black/50">
          <LoadingSpinner size="large" />
        </View>
      )}
      <View className="bg-body-bg" style={{ paddingBottom: contentPageNavigationState.isVisible ? 0 : bottom }}>
        <MiniAudioPlayer />
        <PurchaseContentNavigationFooter
          state={contentPageNavigationState}
          bottomInset={contentPageNavigationState.isVisible ? bottom : 0}
          onOpenTableOfContents={() => postContentPageNavigationCommand("openTableOfContents")}
          onGoPrevious={() => postContentPageNavigationCommand("goPrevious")}
          onGoNext={() => postContentPageNavigationCommand("goNext")}
        />
      </View>
    </Screen>
  );
}
