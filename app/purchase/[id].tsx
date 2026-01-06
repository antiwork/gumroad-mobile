import { env } from "@/lib/env";
import { buildApiUrl } from "@/lib/request";
import { File, Paths } from "expo-file-system";
import { useLocalSearchParams } from "expo-router";
import * as Sharing from "expo-sharing";
import { useState } from "react";
import { ActivityIndicator, Alert, View } from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";

interface ClickMessage {
  type: "click";
  payload: {
    resourceId: string;
    isDownload: boolean;
  };
}

const injectedJavascript = `
  window.CustomJavaScriptInterface = {
    onFileClickedEvent: (id, isDownload) => {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: "click",
        payload: {
          resourceId: id,
          isDownload: isDownload,
        }
      }))
    }
  };
`;

const downloadAndShareFile = async (token: string, productFileId: string) => {
  const downloadedFile = await File.downloadFileAsync(
    buildApiUrl(`/mobile/url_redirects/download/${token}/${productFileId}`),
    Paths.cache,
    { idempotent: true },
  );

  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) throw new Error("Sharing is not available on this device");

  await Sharing.shareAsync(downloadedFile.uri);
};

export default function DownloadScreen() {
  const { id, email } = useLocalSearchParams<{ id: string; email: string }>();
  const [isDownloading, setIsDownloading] = useState(false);

  const url = `${env.EXPO_PUBLIC_GUMROAD_URL}/confirm?id=${id}&email=${encodeURIComponent(email)}&destination=mobile_download_page`;

  const handleMessage = async (event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data) as ClickMessage;
      console.info("WebView message received:", message);

      if (message.type === "click") {
        setIsDownloading(true);
        try {
          await downloadAndShareFile(id, message.payload.resourceId);
        } catch (err) {
          console.error("Download failed:", err);
          Alert.alert("Download Failed", err instanceof Error ? err.message : "Failed to download file");
        } finally {
          setIsDownloading(false);
        }
      } else {
        console.warn("Unknown message from webview:", message);
      }
    } catch (error) {
      console.error("Failed to parse WebView message:", error, event.nativeEvent.data);
    }
  };

  return (
    <View className="flex-1 bg-[#25292e]">
      <WebView
        source={{ uri: url }}
        className="flex-1"
        webviewDebuggingEnabled
        pullToRefreshEnabled
        injectedJavaScript={injectedJavascript}
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
