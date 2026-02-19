import { MiniAudioPlayer } from "@/components/mini-audio-player";
import { StyledWebView } from "@/components/styled";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Screen } from "@/components/ui/screen";
import { useAudioPlayerSync } from "@/components/use-audio-player-sync";
import { useAuth } from "@/lib/auth-context";
import { env } from "@/lib/env";
import { buildApiUrl } from "@/lib/request";
import { usePurchase } from "@/lib/use-purchases";
import { File, Paths } from "expo-file-system";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { useRef, useState } from "react";
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
  const purchase = usePurchase(id);
  const router = useRouter();
  const { isLoading, accessToken } = useAuth();
  const webViewRef = useRef<BaseWebView>(null);
  const url = `${env.EXPO_PUBLIC_GUMROAD_URL}/d/${id}?display=mobile_app&access_token=${accessToken}&mobile_token=${env.EXPO_PUBLIC_MOBILE_TOKEN}`;

  const { pauseAudio, playAudio } = useAudioPlayerSync(webViewRef);
  const { bottom } = useSafeAreaInsets();

  const handleMessage = async (event: WebViewMessageEvent) => {
    const data = event.nativeEvent.data;
    try {
      const message = JSON.parse(data) as ClickMessage;
      console.info("WebView message received:", message);

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
      />
      {isDownloading && (
        <View className="absolute inset-0 items-center justify-center bg-black/50">
          <LoadingSpinner size="large" />
        </View>
      )}
      <View className="bg-body-bg" style={{ paddingBottom: bottom }}>
        <MiniAudioPlayer />
      </View>
    </Screen>
  );
}
