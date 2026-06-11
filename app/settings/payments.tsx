import { StyledWebView } from "@/components/styled";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import { env } from "@/lib/env";
import { safeOpenURL } from "@/lib/open-url";
import { Stack } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { TouchableOpacity, View } from "react-native";
import { WebView as BaseWebView, WebViewMessageEvent } from "react-native-webview";

const gumroadOrigin = new URL(env.EXPO_PUBLIC_GUMROAD_URL).origin;

const isWebUrl = (url: string) => /^https?:\/\//.test(url);

const isGumroadUrl = (url: string) => {
  try {
    return new URL(url).origin === gumroadOrigin;
  } catch {
    return false;
  }
};

export default function PayoutSettingsScreen() {
  const { isLoading, accessToken } = useAuth();
  const webViewRef = useRef<BaseWebView>(null);
  const [canSave, setCanSave] = useState(false);

  const url = useMemo(
    () =>
      `${env.EXPO_PUBLIC_GUMROAD_URL}/settings/payments?display=mobile_app&access_token=${accessToken}&mobile_token=${env.EXPO_PUBLIC_MOBILE_TOKEN}`,
    [accessToken],
  );

  const handleSave = useCallback(() => {
    webViewRef.current?.postMessage(JSON.stringify({ type: "mobileAppSettingsSave" }));
  }, []);

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data) as { type: string; canUpdate?: boolean };
      if (message.type === "settingsCanUpdate") setCanSave(Boolean(message.canUpdate));
    } catch {
      // ignore non-JSON messages
    }
  }, []);

  const handleShouldStartLoadWithRequest = useCallback(
    (request: { url: string; mainDocumentURL?: string }) => {
      if (request.mainDocumentURL && request.url !== request.mainDocumentURL) return true;
      if (request.url === url || !isWebUrl(request.url) || isGumroadUrl(request.url)) return true;
      safeOpenURL(request.url);
      return false;
    },
    [url],
  );

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
          title: "Payouts",
          headerRight: () => (
            <TouchableOpacity onPress={handleSave} disabled={!canSave} className="mr-3">
              <Text className={canSave ? "font-sans text-accent" : "font-sans text-muted"}>Save</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <StyledWebView
        key={accessToken ?? "anonymous"}
        ref={webViewRef}
        source={{ uri: url }}
        className="flex-1 bg-transparent"
        webviewDebuggingEnabled
        pullToRefreshEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        originWhitelist={["*"]}
        onMessage={handleMessage}
        onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
      />
    </Screen>
  );
}
