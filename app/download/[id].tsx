import { useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";

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

export default function DownloadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const url = `https://gumroad.com/d/${id}?display=mobile_app`;

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      console.info("WebView message received:", message);
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
    </View>
  );
}
