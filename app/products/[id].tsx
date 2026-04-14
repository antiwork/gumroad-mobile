import { StyledWebView } from "@/components/styled";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import { env } from "@/lib/env";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { View } from "react-native";
import { WebView as BaseWebView, WebViewMessageEvent } from "react-native-webview";
import * as Sentry from "@sentry/react-native";

export default function ProductEdit() {
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const productId = Array.isArray(id) ? id[0] : id;
  const { isLoading: isAuthLoading, accessToken } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [webError, setWebError] = useState<string | null>(null);
  const webViewRef = useRef<BaseWebView>(null);

  if (!productId) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center px-4">
          <Text className="text-center text-muted">Unable to load product editor.</Text>
        </View>
      </Screen>
    );
  }

  const url = accessToken
    ? `${env.EXPO_PUBLIC_GUMROAD_URL}/products/${productId}/edit?display=mobile_app&access_token=${accessToken}&mobile_token=${env.EXPO_PUBLIC_MOBILE_TOKEN}`
    : `${env.EXPO_PUBLIC_GUMROAD_URL}/products/${productId}/edit?display=mobile_app&mobile_token=${env.EXPO_PUBLIC_MOBILE_TOKEN}`;

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
        onError={(event) => {
          const description = event.nativeEvent.description || "Failed to load product editor";
          setWebError(description);
          Sentry.captureMessage("Product edit WebView failed", {
            level: "error",
            extra: { description, failingUrl: event.nativeEvent.url, productId },
          });
        }}
        onLoadEnd={() => setIsLoading(false)}
      />
      {webError ? (
        <View className="absolute bottom-4 left-4 right-4 rounded border border-border bg-background px-3 py-2">
          <Text className="text-xs text-muted">{webError}</Text>
        </View>
      ) : null}
    </Screen>
  );
}
