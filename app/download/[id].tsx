import { env } from "@/lib/env";
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

const downloadAndShareFile = async (token: string, productFileId: string): Promise<void> => {
  const downloadUrl = `https://api.gumroad.com/mobile/url_redirects/download/${token}/${productFileId}?mobile_token=${env.EXPO_PUBLIC_MOBILE_TOKEN}`;
  const downloadedFile = await File.downloadFileAsync(downloadUrl, Paths.cache, { idempotent: true });

  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) throw new Error("Sharing is not available on this device");

  await Sharing.shareAsync(downloadedFile.uri);
};

export default function DownloadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [isDownloading, setIsDownloading] = useState(false);

  const url = `https://gumroad.com/d/${id}?display=mobile_app`;

  const handleMessage = async (event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data) as ClickMessage;
      console.info("WebView message received:", message);

      if (message.type === "click" && id) {
        setIsDownloading(true);
        try {
          await downloadAndShareFile(id, message.payload.resourceId);
        } catch (err) {
          console.error("Download failed:", err);
          Alert.alert("Download Failed", err instanceof Error ? err.message : "Failed to download file");
        } finally {
          setIsDownloading(false);
        }
      }
    } catch (error) {
      console.error("Failed to parse WebView message:", error);
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
