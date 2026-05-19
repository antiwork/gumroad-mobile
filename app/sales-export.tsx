import { StyledWebView } from "@/components/styled";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Screen } from "@/components/ui/screen";
import { useAuth } from "@/lib/auth-context";
import { env } from "@/lib/env";
import { safeOpenURL } from "@/lib/open-url";
import { getExportAllSalesUrl } from "@/lib/sales-export";
import { Stack } from "expo-router";
import { useCallback, useMemo } from "react";
import { View } from "react-native";

const gumroadOrigin = new URL(env.EXPO_PUBLIC_GUMROAD_URL).origin;

const isWebUrl = (url: string) => /^https?:\/\//.test(url);

const isGumroadUrl = (url: string) => {
  try {
    return new URL(url).origin === gumroadOrigin;
  } catch {
    return false;
  }
};

export default function SalesExportScreen() {
  const { isLoading, accessToken } = useAuth();
  const url = useMemo(() => getExportAllSalesUrl(accessToken), [accessToken]);

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
      <Stack.Screen options={{ title: "Export all sales" }} />
      <StyledWebView
        key={accessToken ?? "anonymous"}
        source={{ uri: url }}
        className="flex-1 bg-transparent"
        webviewDebuggingEnabled
        pullToRefreshEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        originWhitelist={["*"]}
        onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
      />
    </Screen>
  );
}
