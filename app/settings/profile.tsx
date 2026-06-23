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
import type { WebViewErrorEvent, WebViewHttpErrorEvent, WebViewOpenWindowEvent } from "react-native-webview/lib/WebViewTypes";

const gumroadOrigin = new URL(env.EXPO_PUBLIC_GUMROAD_URL).origin;

const allowedHostSuffixes = [".stripe.com", ".paypal.com", ".cloudflare.com"];

const isWebUrl = (url: string) => /^https?:\/\//.test(url);

const isPaymentProviderUrl = (url: string) => {
  try {
    const { hostname } = new URL(url);
    return allowedHostSuffixes.some((suffix) => hostname === suffix.slice(1) || hostname.endsWith(suffix));
  } catch {
    return false;
  }
};

const isAllowedInWebView = (url: string) => {
  try {
    return new URL(url).origin === gumroadOrigin || isPaymentProviderUrl(url);
  } catch {
    return false;
  }
};

const buildProfileUrl = (token: string | null) =>
  `${env.EXPO_PUBLIC_GUMROAD_URL}/settings/profile?display=mobile_app&access_token=${token}&mobile_token=${env.EXPO_PUBLIC_MOBILE_TOKEN}`;

export default function ProfileSettingsScreen() {
  const { isLoading, accessToken } = useAuth();
  const webViewRef = useRef<BaseWebView>(null);
  const [canSave, setCanSave] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const sessionTokenRef = useRef(accessToken);
  if (sessionTokenRef.current == null) sessionTokenRef.current = accessToken;
  const sessionToken = sessionTokenRef.current;

  const url = useMemo(() => buildProfileUrl(sessionToken), [sessionToken]);

  const mainUrlRef = useRef(url);

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

  const handleOpenWindow = useCallback((event: WebViewOpenWindowEvent) => {
    const { targetUrl } = event.nativeEvent;
    if (isPaymentProviderUrl(targetUrl)) {
      webViewRef.current?.injectJavaScript(`window.location.href = ${JSON.stringify(targetUrl)}; true;`);
    } else {
      safeOpenURL(targetUrl);
    }
  }, []);

  const handleRetry = useCallback(() => {
    sessionTokenRef.current = accessToken;
    mainUrlRef.current = buildProfileUrl(accessToken);
    setCanSave(false);
    setHasError(false);
    setReloadKey((k) => k + 1);
  }, [accessToken]);

  const handleError = useCallback((event: WebViewErrorEvent) => {
    if (event.nativeEvent.url !== mainUrlRef.current) return;
    setCanSave(false);
    setHasError(true);
    Sentry.captureException(new Error(`Profile WebView load error: ${event.nativeEvent.description}`));
  }, []);

  const handleHttpError = useCallback((event: WebViewHttpErrorEvent) => {
    if (event.nativeEvent.url !== mainUrlRef.current) return;
    setCanSave(false);
    setHasError(true);
    Sentry.captureException(
      new Error(`Profile WebView HTTP error ${event.nativeEvent.statusCode}: ${event.nativeEvent.description}`),
    );
  }, []);

  useEffect(() => {
    mainUrlRef.current = url;
    setCanSave(false);
    setHasError(false);
  }, [url]);

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
      <StyledWebView
        key={`${sessionToken ?? "anonymous"}-${reloadKey}`}
        ref={webViewRef}
        source={{ uri: url }}
        className="flex-1 bg-transparent"
        webviewDebuggingEnabled={__DEV__}
        pullToRefreshEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        setSupportMultipleWindows
        javaScriptCanOpenWindowsAutomatically
        originWhitelist={["*"]}
        onMessage={handleMessage}
        onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
        onOpenWindow={handleOpenWindow}
        onNavigationStateChange={(navState) => {
          mainUrlRef.current = navState.url;
        }}
        onError={handleError}
        onHttpError={handleHttpError}
      />
      {hasError ? (
        <View className="absolute inset-0 items-center justify-center gap-4 bg-body-bg p-6">
          <Text className="text-center text-lg font-bold text-foreground">Something went wrong</Text>
          <Text className="text-center font-sans text-muted">
            We couldn&apos;t load your profile settings. Please check your connection and try again.
          </Text>
          <Button onPress={handleRetry}>
            <Text>Retry</Text>
          </Button>
        </View>
      ) : null}
    </Screen>
  );
}
