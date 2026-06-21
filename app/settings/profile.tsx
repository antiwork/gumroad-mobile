import { StyledWebView } from "@/components/styled";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import { env } from "@/lib/env";
import { safeOpenURL } from "@/lib/open-url";
import * as Sentry from "@sentry/react-native";
import { Stack } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TouchableOpacity, View } from "react-native";
import { WebView as BaseWebView, WebViewMessageEvent } from "react-native-webview";
import type { WebViewErrorEvent, WebViewHttpErrorEvent } from "react-native-webview/lib/WebViewTypes";

const gumroadOrigin = new URL(env.EXPO_PUBLIC_GUMROAD_URL).origin;

const allowedHostSuffixes = [".stripe.com", ".paypal.com", ".cloudflare.com"];

const isWebUrl = (url: string) => /^https?:\/\//.test(url);

const isAllowedInWebView = (url: string) => {
  try {
    const { origin, hostname } = new URL(url);
    if (origin === gumroadOrigin) return true;
    return allowedHostSuffixes.some((suffix) => hostname === suffix.slice(1) || hostname.endsWith(suffix));
  } catch {
    return false;
  }
};

export default function ProfileSettingsScreen() {
  const { isLoading, accessToken } = useAuth();
  const webViewRef = useRef<BaseWebView>(null);
  const [canSave, setCanSave] = useState(false);
  const [hasError, setHasError] = useState(false);

  const url = useMemo(
    () =>
      `${env.EXPO_PUBLIC_GUMROAD_URL}/settings/profile?display=mobile_app&access_token=${accessToken}&mobile_token=${env.EXPO_PUBLIC_MOBILE_TOKEN}`,
    [accessToken],
  );

  const handleSave = useCallback(() => {
    webViewRef.current?.postMessage(JSON.stringify({ type: "mobileAppSettingsSave" }));
  }, []);

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data) as { type: string; canUpdate?: boolean };
      if (message.type === "settingsCanUpdate") setCanSave(Boolean(message.canUpdate));
    } catch {}
  }, []);

  const handleShouldStartLoadWithRequest = useCallback(
    (request: { url: string; mainDocumentURL?: string }) => {
      if (request.mainDocumentURL && request.url !== request.mainDocumentURL) return true;
      if (request.url === url || !isWebUrl(request.url) || isAllowedInWebView(request.url)) return true;
      safeOpenURL(request.url);
      return false;
    },
    [url],
  );

  const handleRetry = useCallback(() => {
    setCanSave(false);
    setHasError(false);
  }, []);

  const handleError = useCallback((event: WebViewErrorEvent) => {
    setCanSave(false);
    setHasError(true);
    Sentry.captureException(new Error(`Profile WebView load error: ${event.nativeEvent.description}`));
  }, []);

  const handleHttpError = useCallback(
    (event: WebViewHttpErrorEvent) => {
      if (event.nativeEvent.url !== url) return;
      setCanSave(false);
      setHasError(true);
      Sentry.captureException(new Error(`Profile WebView HTTP error: ${event.nativeEvent.statusCode}`));
    },
    [url],
  );

  useEffect(() => setCanSave(false), [accessToken]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-body-bg">
        <LoadingSpinner size="large" />
      </View>
    );
  }

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: "Profile",
          headerRight: () => (
            <TouchableOpacity onPress={handleSave} disabled={!canSave || hasError} className="mr-3">
              <Text className={canSave && !hasError ? "font-sans text-accent" : "font-sans text-muted"}>Save</Text>
            </TouchableOpacity>
          ),
        }}
      />
      {hasError ? (
        <View className="flex-1 items-center justify-center gap-4 bg-body-bg p-6">
          <Text className="text-center text-lg font-bold text-foreground">Something went wrong</Text>
          <Text className="text-center font-sans text-muted">
            We couldn&apos;t load your profile settings. Please check your connection and try again.
          </Text>
          <Button onPress={handleRetry}>
            <Text>Retry</Text>
          </Button>
        </View>
      ) : (
        <StyledWebView
          key={accessToken ?? "anonymous"}
          ref={webViewRef}
          source={{ uri: url }}
          className="flex-1 bg-transparent"
          webviewDebuggingEnabled={__DEV__}
          pullToRefreshEnabled
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          originWhitelist={["*"]}
          onMessage={handleMessage}
          onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
          onError={handleError}
          onHttpError={handleHttpError}
        />
      )}
    </Screen>
  );
}
