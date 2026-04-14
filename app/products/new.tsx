import { StyledWebView } from "@/components/styled";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Screen } from "@/components/ui/screen";
import { useAuth } from "@/lib/auth-context";
import { env } from "@/lib/env";
import { useCallback, useRef, useState } from "react";
import { View } from "react-native";
import { WebView as BaseWebView, WebViewMessageEvent } from "react-native-webview";
import * as Sentry from "@sentry/react-native";

export default function ProductNew() {
  const { isLoading: isAuthLoading, accessToken } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const webViewRef = useRef<BaseWebView>(null);

  const url = accessToken
    ? `${env.EXPO_PUBLIC_GUMROAD_URL}/products/new?display=mobile_app&access_token=${accessToken}&mobile_token=${env.EXPO_PUBLIC_MOBILE_TOKEN}`
    : `${env.EXPO_PUBLIC_GUMROAD_URL}/products/new?display=mobile_app&mobile_token=${env.EXPO_PUBLIC_MOBILE_TOKEN}`;

  const handleShouldStartLoadWithRequest = useCallback(
    (request: { url: string; navigationType: string; mainDocumentURL?: string }) => {
      if (request.mainDocumentURL && request.url !== request.mainDocumentURL) return true;
      if (
        request.url === url ||
        request.url.startsWith(env.EXPO_PUBLIC_GUMROAD_URL) ||
        request.url.startsWith("https://challenges.cloudflare.com/") ||
        request.url.startsWith("https://connect-js.stripe.com/") ||
        request.url.startsWith("https://gumroad.com/") ||
        request.url.startsWith("https://www.gumroad.com/") ||
        !/^https?:\/\//.test(request.url)
      )
        return true;
      return false;
    },
    [url],
  );

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    const data = event.nativeEvent.data;
    try {
      const message = JSON.parse(data);
      console.info("WebView message received:", message);
    } catch (error) {
      Sentry.captureException(error);
    }
  }, []);

  if (isAuthLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-body-bg">
        <LoadingSpinner size="large" />
      </View>
    );
  }

  return (
    <Screen>
      {isLoading && (
        <View className="absolute inset-0 items-center justify-center bg-body-bg z-10">
          <LoadingSpinner size="large" />
        </View>
      )}
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
        onLoadEnd={() => setIsLoading(false)}
      />
    </Screen>
  );
}
