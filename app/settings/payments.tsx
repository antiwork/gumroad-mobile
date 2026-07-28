import { StyledWebView } from "@/components/styled";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { env } from "@/lib/env";
import { safeOpenURL } from "@/lib/open-url";
import { useWebViewSession } from "@/lib/use-webview-session";
import { buildAuthenticatedWebViewUrl } from "@/lib/webview-url";
import * as Sentry from "@sentry/react-native";
import { Stack } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { TouchableOpacity, View } from "react-native";
import { WebView as BaseWebView, WebViewMessageEvent } from "react-native-webview";
import type {
  WebViewErrorEvent,
  WebViewHttpErrorEvent,
  WebViewOpenWindowEvent,
} from "react-native-webview/lib/WebViewTypes";

const gumroadOrigin = new URL(env.EXPO_PUBLIC_GUMROAD_URL).origin;

const allowedHostSuffixes = [".stripe.com", ".paypal.com", ".cloudflare.com"];

const webViewInternalSchemes = ["about:", "data:", "blob:", "javascript:"];

const isWebViewInternalUrl = (url: string) => {
  const lower = url.toLowerCase();
  return webViewInternalSchemes.some((scheme) => lower.startsWith(scheme));
};

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

const buildPayoutUrl = (token: string) =>
  buildAuthenticatedWebViewUrl("/settings/payments", token, { display: "mobile_app" });

export default function PayoutSettingsScreen() {
  const webViewRef = useRef<BaseWebView>(null);
  const [canSave, setCanSave] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const {
    accessToken,
    handleAuthenticationHttpError,
    handleAuthenticationNavigation,
    handleSessionLoad,
    handleSessionLoadError,
    isLoading,
    url,
    webViewKey,
  } = useWebViewSession(buildPayoutUrl, { syncExternalToken: false });

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
      if (handleAuthenticationNavigation(request.url)) return false;
      if (request.url === url || isWebViewInternalUrl(request.url) || isAllowedInWebView(request.url)) return true;
      safeOpenURL(request.url);
      return false;
    },
    [handleAuthenticationNavigation, url],
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
    mainUrlRef.current = url;
    setCanSave(false);
    setHasError(false);
    setReloadKey((k) => k + 1);
  }, [url]);

  const handleError = useCallback(
    (event: WebViewErrorEvent) => {
      handleSessionLoadError({ token: accessToken });
      if (event.nativeEvent.url !== mainUrlRef.current) return;
      setCanSave(false);
      setHasError(true);
      Sentry.captureException(new Error(`Payouts WebView load error: ${event.nativeEvent.description}`));
    },
    [accessToken, handleSessionLoadError],
  );

  const handleHttpError = useCallback(
    (event: WebViewHttpErrorEvent) => {
      if (handleAuthenticationHttpError(event.nativeEvent)) return;
      if (event.nativeEvent.url !== mainUrlRef.current) return;
      setCanSave(false);
      setHasError(true);
      Sentry.captureException(
        new Error(`Payouts WebView HTTP error ${event.nativeEvent.statusCode}: ${event.nativeEvent.description}`),
      );
    },
    [handleAuthenticationHttpError],
  );

  useEffect(() => {
    mainUrlRef.current = url;
    setCanSave(false);
    setHasError(false);
  }, [url]);

  if (isLoading || url === null) {
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
          title: "Payouts",
          headerRight: () => (
            <TouchableOpacity onPress={handleSave} disabled={!canSave || hasError} className="mr-3">
              <Text className={canSave && !hasError ? "font-sans text-accent" : "font-sans text-muted"}>Save</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <StyledWebView
        key={`${webViewKey}-${reloadKey}`}
        ref={webViewRef}
        source={{ uri: url }}
        className="flex-1 bg-transparent"
        webviewDebuggingEnabled={__DEV__}
        incognito
        pullToRefreshEnabled
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
        onLoad={(event) => {
          handleSessionLoad({ token: accessToken, url: event.nativeEvent.url });
        }}
        onError={handleError}
        onHttpError={handleHttpError}
      />
      {hasError ? (
        <View className="absolute inset-0 items-center justify-center gap-4 bg-body-bg p-6">
          <Text className="text-center text-lg font-bold text-foreground">Something went wrong</Text>
          <Text className="text-center font-sans text-muted">
            We couldn&apos;t load your payout settings. Please check your connection and try again.
          </Text>
          <Button onPress={handleRetry}>
            <Text>Retry</Text>
          </Button>
        </View>
      ) : null}
    </Screen>
  );
}
