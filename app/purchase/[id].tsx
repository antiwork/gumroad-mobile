import { usePurchases } from "@/app/index";
import { env } from "@/lib/env";
import { buildApiUrl } from "@/lib/request";
import { File, Paths } from "expo-file-system";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
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

  const purchase = purchases.find((p) => p.url_redirect_token === id);
  const url = `${env.EXPO_PUBLIC_GUMROAD_URL}/d/${id}?display=mobile_app`;

  const handleMessage = async (event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data) as ClickMessage;
      console.info("WebView message received:", message);

      if (message.type === "click") {
        setIsDownloading(true);
        try {
          const downloadedFile = await downloadFile(id, message.payload.resourceId);

          if (downloadedFile.uri.endsWith(".pdf") && !message.payload.isDownload) {
            router.push({
              pathname: "/pdf-viewer",
              params: { uri: downloadedFile.uri, title: purchase?.name },
            });
          } else {
            await shareFile(downloadedFile.uri);
          }
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
      <Stack.Screen options={{ title: purchase?.name ?? "" }} />
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
