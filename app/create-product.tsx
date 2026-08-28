import { StyledWebView } from "@/components/styled";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import { env } from "@/lib/env";
import { safeOpenURL } from "@/lib/open-url";
import { useWebViewSession } from "@/lib/use-webview-session";
import { buildAuthenticatedWebViewUrl } from "@/lib/webview-url";
import * as Sentry from "@sentry/react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { WebView as BaseWebView } from "react-native-webview";
import type {
  WebViewErrorEvent,
  WebViewHttpErrorEvent,
  WebViewOpenWindowEvent,
} from "react-native-webview/lib/WebViewTypes";

const gumroadOrigin = new URL(env.EXPO_PUBLIC_GUMROAD_URL).origin;

const webViewInternalSchemes = ["about:", "data:", "blob:", "javascript:"];

const isWebViewInternalUrl = (url: string) => {
  const lower = url.toLowerCase();
  return webViewInternalSchemes.some((scheme) => lower.startsWith(scheme));
};

const isAllowedInWebView = (url: string) => {
  try {
    return new URL(url).origin === gumroadOrigin;
  } catch {
    return false;
  }
};

const isProductEditUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    return parsed.origin === gumroadOrigin && /^\/products\/[^/]+\/edit/.test(parsed.pathname);
  } catch {
    return false;
  }
};

const buildCreateProductUrl = (token: string) =>
  buildAuthenticatedWebViewUrl("/products/new", token, { display: "mobile_app" });

const SCREENSHOT_CREATE_HTML = `<!DOCTYPE html><html><head><meta name=viewport content="width=device-width,initial-scale=1"><style>
body{margin:0;font-family:-apple-system,sans-serif;background:#fff;color:#000;padding:20px}
label{display:block;font-size:13px;color:#666;margin:16px 0 6px}
input{width:100%;box-sizing:border-box;border:1px solid #ddd;border-radius:8px;padding:14px;font-size:16px}
.btn{margin-top:28px;background:#ff90e8;color:#000;text-align:center;font-weight:800;padding:16px;border-radius:999px;font-size:16px}
</style></head><body>
<label>Name</label><input value="Oil painting course">
<label>Price</label><input value="$49">
<label>Type</label><input value="Course">
<div class=btn>Publish</div>
</body></html>`;
const CreateProductScreen = () => {
  const webViewRef = useRef<BaseWebView>(null);
  const [hasError, setHasError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const { refreshCreatorStatus } = useAuth();
  const hasCreatedProductRef = useRef(false);
  const {
    accessToken,
    handleAuthenticationHttpError,
    handleAuthenticationNavigation,
    handleSessionLoad,
    handleSessionLoadError,
    isLoading,
    url,
    webViewKey,
  } = useWebViewSession(buildCreateProductUrl, { syncExternalToken: false });

  const mainUrlRef = useRef(url);

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
    safeOpenURL(event.nativeEvent.targetUrl);
  }, []);

  const handleRetry = useCallback(() => {
    mainUrlRef.current = url;
    setHasError(false);
    setReloadKey((k) => k + 1);
  }, [url]);

  const handleError = useCallback(
    (event: WebViewErrorEvent) => {
      handleSessionLoadError({ token: accessToken });
      if (event.nativeEvent.url !== mainUrlRef.current) return;
      setHasError(true);
      Sentry.captureException(new Error(`Create product WebView load error: ${event.nativeEvent.description}`));
    },
    [accessToken, handleSessionLoadError],
  );

  const handleHttpError = useCallback(
    (event: WebViewHttpErrorEvent) => {
      if (handleAuthenticationHttpError(event.nativeEvent)) return;
      if (event.nativeEvent.url !== mainUrlRef.current) return;
      setHasError(true);
      Sentry.captureException(
        new Error(
          `Create product WebView HTTP error ${event.nativeEvent.statusCode}: ${event.nativeEvent.description}`,
        ),
      );
    },
    [handleAuthenticationHttpError],
  );

  useEffect(() => {
    mainUrlRef.current = url;
    setHasError(false);
  }, [url]);

  useEffect(
    () => () => {
      if (hasCreatedProductRef.current) void refreshCreatorStatus();
    },
    [refreshCreatorStatus],
  );

  if (accessToken === "screenshot-fake-token") {
    return (
      <Screen>
        <StyledWebView source={{ html: SCREENSHOT_CREATE_HTML }} className="flex-1 bg-transparent" />
      </Screen>
    );
  }

  if (isLoading || url === null) {
    return (
      <View className="flex-1 items-center justify-center bg-body-bg">
        <LoadingSpinner size="large" />
      </View>
    );
  }

  return (
    <Screen>
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
        onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
        onOpenWindow={handleOpenWindow}
        onNavigationStateChange={(navState) => {
          mainUrlRef.current = navState.url;
          if (isProductEditUrl(navState.url)) hasCreatedProductRef.current = true;
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
            We couldn&apos;t load the product creation page. Please check your connection and try again.
          </Text>
          <Button onPress={handleRetry}>
            <Text>Retry</Text>
          </Button>
        </View>
      ) : null}
    </Screen>
  );
};

export default CreateProductScreen;
