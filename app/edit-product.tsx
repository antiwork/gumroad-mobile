import { PRODUCTS_QUERY_KEY } from "@/components/products/use-products";
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
import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
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

const EditProductScreen = () => {
  const { permalink } = useLocalSearchParams<{ permalink?: string }>();
  const queryClient = useQueryClient();
  const productPath = permalink ? `/products/${encodeURIComponent(permalink)}/edit` : null;
  const buildEditProductUrl = useCallback(
    (token: string) => buildAuthenticatedWebViewUrl(productPath ?? "/products", token, { display: "mobile_app" }),
    [productPath],
  );
  const webViewRef = useRef<BaseWebView>(null);
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
  } = useWebViewSession(buildEditProductUrl, { syncExternalToken: false });

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
      Sentry.captureException(new Error(`Edit product WebView load error: ${event.nativeEvent.description}`));
    },
    [accessToken, handleSessionLoadError],
  );

  const handleHttpError = useCallback(
    (event: WebViewHttpErrorEvent) => {
      if (handleAuthenticationHttpError(event.nativeEvent)) return;
      if (event.nativeEvent.url !== mainUrlRef.current) return;
      setHasError(true);
      Sentry.captureException(
        new Error(`Edit product WebView HTTP error ${event.nativeEvent.statusCode}: ${event.nativeEvent.description}`),
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
      void queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY });
    },
    [queryClient],
  );

  if (!permalink) {
    return (
      <View className="flex-1 items-center justify-center bg-body-bg p-6">
        <Text className="text-center font-sans text-foreground">This product could not be opened.</Text>
      </View>
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
            We couldn&apos;t load the product editor. Please check your connection and try again.
          </Text>
          <Button onPress={handleRetry}>
            <Text>Retry</Text>
          </Button>
        </View>
      ) : null}
    </Screen>
  );
};

export default EditProductScreen;
