import { StyledWebView } from "@/components/styled";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import { env } from "@/lib/env";
import { safeOpenURL } from "@/lib/open-url";
import * as Sentry from "@sentry/react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Alert, View } from "react-native";
import { WebView as BaseWebView, WebViewMessageEvent } from "react-native-webview";

type WebMessage =
  | { type: "productSaveSuccess"; payload: Record<string, never> }
  | { type: "productSaveError"; payload: { message: string } }
  | { type: "productSaveWarning"; payload: { message: string } }
  | { type: "productPublishSuccess"; payload: Record<string, never> }
  | { type: "productUnpublishSuccess"; payload: Record<string, never> }
  | { type: "productTabChange"; payload: { tab: string } };

export default function ProductEdit() {
  const { id, uniquePermalink, published: publishedParam } = useLocalSearchParams<{
    id: string | string[];
    uniquePermalink: string | string[];
    published: string;
  }>();
  const productId = Array.isArray(id) ? id[0] : id;
  const permalink = Array.isArray(uniquePermalink) ? uniquePermalink[0] : uniquePermalink;
  const { isLoading: isAuthLoading, accessToken } = useAuth();
  const router = useRouter();
  const webViewRef = useRef<BaseWebView>(null);
  const [isPublished, setIsPublished] = useState(publishedParam === "true");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const editPathPrefix = permalink ? `/products/${encodeURIComponent(permalink)}/edit` : null;
  const url =
    editPathPrefix && accessToken
      ? `${env.EXPO_PUBLIC_GUMROAD_URL}${editPathPrefix}?display=mobile_app&access_token=${accessToken}&mobile_token=${env.EXPO_PUBLIC_MOBILE_TOKEN}`
      : null;

  const handleShouldStartLoadWithRequest = useCallback(
    (request: { url: string; navigationType: string; mainDocumentURL?: string }) => {
      if (request.mainDocumentURL && request.url !== request.mainDocumentURL) return true;
      if (
        !url ||
        !editPathPrefix ||
        request.url === url ||
        request.url.startsWith("https://challenges.cloudflare.com/") ||
        request.url.startsWith("https://connect-js.stripe.com/") ||
        !/^https?:\/\//.test(request.url)
      )
        return true;
      if (request.url.startsWith(env.EXPO_PUBLIC_GUMROAD_URL)) {
        const path = request.url.slice(env.EXPO_PUBLIC_GUMROAD_URL.length).split("?")[0] ?? "";
        if (path.startsWith(editPathPrefix)) return true;
      }
      safeOpenURL(request.url);
      return false;
    },
    [url, editPathPrefix],
  );

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const message = JSON.parse(event.nativeEvent.data) as WebMessage;
        if (message.type === "productSaveSuccess") {
          setIsSaving(false);
        } else if (message.type === "productSaveError") {
          setIsSaving(false);
          Alert.alert("Save Failed", message.payload.message || "Could not save product.");
        } else if (message.type === "productSaveWarning") {
          setIsSaving(false);
          Alert.alert("Saved with warnings", message.payload.message);
        } else if (message.type === "productPublishSuccess") {
          setIsPublished(true);
          setIsSaving(false);
        } else if (message.type === "productUnpublishSuccess") {
          setIsPublished(false);
          setIsSaving(false);
        } else if (message.type === "productTabChange") {
          // TODO(#60): Reflect the active editor tab in a native tab bar instead of keeping it inside the webview.
        }
      } catch (error) {
        Sentry.captureException(error);
      }
    },
    [],
  );

  const handleSavePress = useCallback(() => {
    setIsSaving(true);
    webViewRef.current?.postMessage(JSON.stringify({ type: "mobileAppProductSave", payload: {} }));
  }, []);

  const handlePublishPress = useCallback(() => {
    setIsSaving(true);
    webViewRef.current?.postMessage(
      JSON.stringify({
        type: isPublished ? "mobileAppProductUnpublish" : "mobileAppProductPublish",
        payload: {},
      }),
    );
  }, [isPublished]);

  if (!productId || !permalink) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center px-4">
          <Text className="text-center text-muted">Unable to load product editor.</Text>
        </View>
      </Screen>
    );
  }

  if (isAuthLoading || !url) {
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
          title: "Edit product",
          headerLeft: () => (
            <Button size="sm" variant="ghost" onPress={() => router.back()} disabled={isSaving}>
              <Text>Back</Text>
            </Button>
          ),
          headerRight: () => (
            <View className="flex-row gap-2">
              <Button
                size="sm"
                variant="outline"
                onPress={handlePublishPress}
                disabled={isSaving}
                testID="toggle-publish-button"
              >
                <Text>{isPublished ? "Unpublish" : "Publish"}</Text>
              </Button>
              <Button
                size="sm"
                variant="accent"
                onPress={handleSavePress}
                disabled={isSaving}
                testID="save-button"
              >
                <Text>Save</Text>
              </Button>
            </View>
          ),
        }}
      />
      <StyledWebView
        ref={webViewRef}
        source={{ uri: url }}
        className="flex-1 bg-transparent"
        webviewDebuggingEnabled
        pullToRefreshEnabled
        incognito
        originWhitelist={["*"]}
        onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
        onMessage={handleMessage}
        onLoadStart={() => setIsLoading(true)}
        onLoadEnd={() => setIsLoading(false)}
        testID="product-edit-webview"
      />
      {isLoading || isSaving ? (
        <View className="absolute inset-0 items-center justify-center bg-black/50">
          <LoadingSpinner size="large" />
        </View>
      ) : null}
    </Screen>
  );
}
