import { LineIcon } from "@/components/icon";
import { StyledWebView } from "@/components/styled";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Text } from "@/components/ui/text";
import {
  hideFullscreenSystemBars,
  prepareFullscreenOrientation,
  restoreAppOrientation,
  restoreFullscreenSystemBars,
} from "@/lib/fullscreen";
import { useAuth } from "@/lib/auth-context";
import { safeOpenURL } from "@/lib/open-url";
import { useWebViewSession } from "@/lib/use-webview-session";
import { buildAuthenticatedWebViewUrl, isWebBuildContentPageUrl, isWebBuildPlayerUrl } from "@/lib/webview-url";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView as BaseWebView } from "react-native-webview";
import type { WebViewHttpErrorEvent } from "react-native-webview/lib/WebViewTypes";

const webViewInternalSchemes = ["about:", "data:", "blob:", "javascript:"];

const isWebViewInternalUrl = (url: string) => {
  const lower = url.toLowerCase();
  return webViewInternalSchemes.some((scheme) => lower.startsWith(scheme));
};

const BuildPlayerScreen = () => {
  const { token, title } = useLocalSearchParams<{ token: string; title?: string }>();
  const router = useRouter();
  const { bottom } = useSafeAreaInsets();
  const webViewRef = useRef<BaseWebView>(null);
  const mountedRef = useRef(true);
  const fullscreenRef = useRef(false);
  const fullscreenRequestIdRef = useRef(0);
  const fullscreenPendingRef = useRef(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const buildPlayerUrl = useCallback(
    (accessToken: string) =>
      buildAuthenticatedWebViewUrl(`/d/${encodeURIComponent(token)}/play`, accessToken, { display: "mobile_app" }),
    [token],
  );
  const {
    handleAuthenticationHttpError,
    handleAuthenticationNavigation,
    handleSessionLoad,
    handleSessionLoadError,
    isLoading,
    url,
    webViewKey,
  } = useWebViewSession(buildPlayerUrl);
  const { accessToken } = useAuth();

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      restoreFullscreenSystemBars();
      restoreAppOrientation();
    };
  }, []);

  const exitFullscreen = useCallback(() => {
    fullscreenRequestIdRef.current += 1;
    fullscreenRef.current = false;
    restoreFullscreenSystemBars();
    restoreAppOrientation();
    setIsFullscreen(false);
  }, []);

  const enterFullscreen = useCallback(async () => {
    if (fullscreenPendingRef.current) return;
    fullscreenPendingRef.current = true;
    const requestId = ++fullscreenRequestIdRef.current;
    const orientationApplied = await prepareFullscreenOrientation();
    const barsHidden = orientationApplied ? await hideFullscreenSystemBars() : false;
    fullscreenPendingRef.current = false;
    if (!mountedRef.current || fullscreenRequestIdRef.current !== requestId || !orientationApplied || !barsHidden) {
      if (orientationApplied) restoreAppOrientation();
      if (barsHidden) restoreFullscreenSystemBars();
      return;
    }
    fullscreenRef.current = true;
    setIsFullscreen(true);
  }, []);

  const handleShouldStartLoadWithRequest = useCallback(
    (request: { url: string; navigationType: string; mainDocumentURL?: string }) => {
      if (request.mainDocumentURL && request.url !== request.mainDocumentURL) return true;
      if (handleAuthenticationNavigation(request.url)) return false;
      if (isWebBuildPlayerUrl(request.url, token) || isWebViewInternalUrl(request.url)) return true;
      if (isWebBuildContentPageUrl(request.url, token)) {
        router.back();
        return false;
      }
      safeOpenURL(request.url);
      return false;
    },
    [handleAuthenticationNavigation, router, token],
  );

  if (isLoading || url === null) {
    return (
      <View className="flex-1 items-center justify-center bg-player">
        <Stack.Screen options={{ title: title ?? "", headerShown: false }} />
        <LoadingSpinner size="large" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-player">
      <Stack.Screen
        options={{
          title: title ?? "",
          headerShown: !isFullscreen,
          headerStyle: { backgroundColor: "#000000" },
          headerTintColor: "#ffffff",
        }}
      />
      <StyledWebView
        key={webViewKey}
        ref={webViewRef}
        testID="build-player-webview"
        source={{ uri: url }}
        className="flex-1 bg-player"
        webviewDebuggingEnabled
        incognito
        thirdPartyCookiesEnabled
        mediaPlaybackRequiresUserAction={false}
        // On iPhone, WebKit refuses to play media inside the page unless this is on and takes it over in a fullscreen player instead. A build in the frame cannot survive that takeover.
        allowsInlineMediaPlayback
        // Android blocks the HTML5 fullscreen API in WebViews unless this is enabled, so a build's own fullscreen button would do nothing. iOS ignores this prop.
        allowsFullscreenVideo
        originWhitelist={["*"]}
        onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
        onOpenWindow={(event) => {
          const targetUrl = event.nativeEvent.targetUrl;
          if (
            handleShouldStartLoadWithRequest({ url: targetUrl, navigationType: "click" }) &&
            !isWebViewInternalUrl(targetUrl)
          )
            safeOpenURL(targetUrl);
        }}
        onLoad={(event) => handleSessionLoad({ token: accessToken, url: event.nativeEvent.url })}
        onError={() => handleSessionLoadError({ token: accessToken })}
        onHttpError={(event: WebViewHttpErrorEvent) => {
          handleAuthenticationHttpError(event.nativeEvent);
        }}
      />
      <View style={{ paddingBottom: bottom }} className="absolute inset-x-0 bottom-0 flex-row justify-end">
        <Pressable
          onPress={isFullscreen ? exitFullscreen : () => void enterFullscreen()}
          accessibilityRole="button"
          accessibilityLabel={isFullscreen ? "Exit full screen" : "Full screen"}
          testID={isFullscreen ? "exit-fullscreen-button" : "fullscreen-button"}
          className="mr-4 flex-row items-center gap-2 rounded-full bg-player-overlay px-4 py-2"
        >
          <LineIcon
            name={isFullscreen ? "fullscreen-exit" : "fullscreen"}
            size={20}
            className="text-player-foreground"
          />
          <Text className="font-sans text-sm text-player-foreground">{isFullscreen ? "Exit" : "Full screen"}</Text>
        </Pressable>
      </View>
    </View>
  );
};

export default BuildPlayerScreen;
