import { usePurchases } from "@/app/index";
import { useAudioPlayerSync } from "@/components/use-audio-player-sync";
import { useAuth } from "@/lib/auth-context";
import { env } from "@/lib/env";
import { buildApiUrl } from "@/lib/request";
import { File, Paths } from "expo-file-system";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { useRef, useState } from "react";
import { ActivityIndicator, Alert, View } from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";

// See antiwork/gumroad:app/javascript/components/Download/Interactions.tsx
type ClickPayload = {
  resourceId: string;
  isDownload: boolean;
  isPost: boolean;
  type?: string | null;
  isPlaying?: "true" | "false" | null;
  resumeAt?: string | null;
  contentLength?: string | null;
};

type ClickMessage = {
  type: "click";
  payload: ClickPayload;
};

const downloadFile = (token: string, productFileId: string) =>
  File.downloadFileAsync(buildApiUrl(`/mobile/url_redirects/download/${token}/${productFileId}`), Paths.cache, {
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
  const { data: purchases = [] } = usePurchases();
  const router = useRouter();
  const { isLoading, accessToken } = useAuth();
  const webViewRef = useRef<WebView>(null);

  const purchase = purchases.find((p) => p.url_redirect_token === id);
  const url = `${env.EXPO_PUBLIC_GUMROAD_URL}/d/${id}?display=mobile_app&access_token=${accessToken}&mobile_token=${env.EXPO_PUBLIC_MOBILE_TOKEN}`;

  const { pauseAudio, playAudio } = useAudioPlayerSync(webViewRef);

  const handleMessage = async (event: WebViewMessageEvent) => {
    const data = event.nativeEvent.data;
    try {
      const message = JSON.parse(data) as ClickMessage;
      console.info("WebView message received:", message);

      if (message.type !== "click") {
        console.warn("Unknown message from webview:", message);
        return;
      }

      setIsDownloading(true);
      const downloadedFile = await downloadFile(id, message.payload.resourceId);

      if (downloadedFile.uri.endsWith(".pdf") && !message.payload.isDownload) {
        router.push({
          pathname: "/pdf-viewer",
          params: { uri: downloadedFile.uri, title: purchase?.name },
        });
      } else if (message.payload.type === "audio") {
        if (message.payload.isPlaying === "true") {
          pauseAudio();
        } else {
          playAudio(
            downloadedFile.uri,
            message.payload.resourceId,
            message.payload.resumeAt ? Number(message.payload.resumeAt) : undefined,
          );
        }
      } else {
        await shareFile(downloadedFile.uri);
      }
    } catch (error) {
      console.error("Download failed:", error, data);
      Alert.alert("Download Failed", error instanceof Error ? error.message : "Failed to download file");
    } finally {
      setIsDownloading(false);
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#25292e]">
        <ActivityIndicator size="large" color="#ff90e8" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#25292e]">
      <Stack.Screen options={{ title: purchase?.name ?? "" }} />
      <WebView
        ref={webViewRef}
        source={{ uri: url }}
        className="flex-1"
        webviewDebuggingEnabled
        pullToRefreshEnabled
        mediaPlaybackRequiresUserAction={false}
        originWhitelist={["*"]}
        onMessage={handleMessage}
      />
      {isDownloading && (
        <View className="absolute inset-0 items-center justify-center bg-black/50">
          <ActivityIndicator size="large" color="#ff90e8" />
        </View>
      )}
    </View>
  );
}
