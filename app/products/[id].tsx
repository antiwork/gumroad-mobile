import { StyledWebView } from "@/components/styled";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import { env } from "@/lib/env";
import { safeOpenURL } from "@/lib/open-url";
import * as Sentry from "@sentry/react-native";
import * as Haptics from "expo-haptics";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { Alert, Pressable, Share, View } from "react-native";
import { WebView as BaseWebView, WebViewMessageEvent } from "react-native-webview";

type WebMessage =
  | { type: "productSaveSuccess"; payload: Record<string, never> }
  | { type: "productSaveError"; payload: { message: string } }
  | { type: "productSaveWarning"; payload: { message: string } }
  | { type: "productPublishSuccess"; payload: Record<string, never> }
  | { type: "productUnpublishSuccess"; payload: Record<string, never> }
  | { type: "productTabChange"; payload: { tab: string } };

type EditorTab = "product" | "content" | "receipt" | "share";
const TABS: { key: EditorTab; label: string }[] = [
  { key: "product", label: "Product" },
  { key: "content", label: "Content" },
  { key: "receipt", label: "Receipt" },
  { key: "share", label: "Share" },
];

const notifySuccess = () => {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
};

const EditorTabBar = ({
  activeTab,
  disabled,
}: {
  activeTab: EditorTab;
  disabled: boolean;
}) => (
  <View
    className="flex-row gap-1 border-b border-border/70 bg-body-bg px-3 py-2"
    testID="editor-tab-bar"
  >
    {TABS.map((tab) => {
      const isActive = tab.key === activeTab;
      return (
        <Pressable
          key={tab.key}
          disabled={disabled}
          hitSlop={6}
          testID={`editor-tab-${tab.key}`}
          className={`rounded px-3 py-1.5 ${isActive ? "bg-accent" : ""} ${disabled ? "opacity-50" : ""}`}
        >
          <Text className={`text-xs ${isActive ? "text-accent-foreground" : "text-muted"}`}>{tab.label}</Text>
        </Pressable>
      );
    })}
  </View>
);

const EditorSkeleton = () => (
  <View className="flex-1 gap-3 px-4 py-6" testID="editor-skeleton">
    <View className="h-8 w-3/4 rounded bg-muted/30" />
    <View className="h-4 w-1/2 rounded bg-muted/20" />
    <View className="mt-4 h-32 w-full rounded bg-muted/20" />
    <View className="h-4 w-full rounded bg-muted/20" />
    <View className="h-4 w-5/6 rounded bg-muted/20" />
    <View className="h-4 w-2/3 rounded bg-muted/20" />
    <View className="mt-6 h-24 w-full rounded bg-muted/20" />
  </View>
);

export default function ProductEdit() {
  const {
    id,
    uniquePermalink,
    published: publishedParam,
    name: nameParam,
    shortUrl: shortUrlParam,
  } = useLocalSearchParams<{
    id: string | string[];
    uniquePermalink: string | string[];
    published: string;
    name: string;
    shortUrl: string;
  }>();
  const productId = Array.isArray(id) ? id[0] : id;
  const permalink = Array.isArray(uniquePermalink) ? uniquePermalink[0] : uniquePermalink;
  const productName = Array.isArray(nameParam) ? nameParam[0] : nameParam;
  const shortUrl = Array.isArray(shortUrlParam) ? shortUrlParam[0] : shortUrlParam;
  const { isLoading: isAuthLoading, accessToken } = useAuth();
  const router = useRouter();
  const webViewRef = useRef<BaseWebView>(null);
  const [isPublished, setIsPublished] = useState(publishedParam === "true");
  const [isSaving, setIsSaving] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<EditorTab>("product");

  const editPathPrefix = permalink ? `/products/${encodeURIComponent(permalink)}/edit` : null;
  const url = useMemo(
    () =>
      editPathPrefix && accessToken
        ? `${env.EXPO_PUBLIC_GUMROAD_URL}${editPathPrefix}?display=mobile_app&access_token=${accessToken}&mobile_token=${env.EXPO_PUBLIC_MOBILE_TOKEN}`
        : null,
    [editPathPrefix, accessToken],
  );

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
          notifySuccess();
          Alert.alert("Changes saved", "Your product has been saved.");
          if (router.canGoBack()) router.back();
        } else if (message.type === "productSaveError") {
          setIsSaving(false);
          Alert.alert("Save Failed", message.payload.message || "Could not save product.");
        } else if (message.type === "productSaveWarning") {
          setIsSaving(false);
          Alert.alert("Saved with warnings", message.payload.message);
        } else if (message.type === "productPublishSuccess") {
          setIsPublished(true);
          setIsSaving(false);
          notifySuccess();
          Alert.alert("Published", "Your product is now live.");
        } else if (message.type === "productUnpublishSuccess") {
          setIsPublished(false);
          setIsSaving(false);
          notifySuccess();
          Alert.alert("Unpublished", "Your product is no longer available for purchase.");
          if (router.canGoBack()) router.back();
        } else if (message.type === "productTabChange") {
          const nextTab = message.payload.tab as EditorTab;
          if (TABS.some((t) => t.key === nextTab)) setActiveTab(nextTab);
        }
      } catch (error) {
        Sentry.captureException(error);
      }
    },
    [router],
  );

  const handleSavePress = useCallback(() => {
    setIsSaving(true);
    webViewRef.current?.postMessage(JSON.stringify({ type: "mobileAppProductSave", payload: {} }));
  }, []);

  const sendPublishMessage = useCallback((publish: boolean) => {
    setIsSaving(true);
    webViewRef.current?.postMessage(
      JSON.stringify({
        type: publish ? "mobileAppProductPublish" : "mobileAppProductUnpublish",
        payload: {},
      }),
    );
  }, []);

  const handlePublishPress = useCallback(() => {
    if (isPublished) {
      Alert.alert(
        "Unpublish product?",
        "Customers will no longer be able to purchase this product. You can republish anytime.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Unpublish", style: "destructive", onPress: () => sendPublishMessage(false) },
        ],
      );
    } else {
      sendPublishMessage(true);
    }
  }, [isPublished, sendPublishMessage]);

  const handleReloadPress = useCallback(() => {
    setLoadError(null);
    webViewRef.current?.reload();
  }, []);

  const handleSharePress = useCallback(async () => {
    if (!shortUrl) return;
    try {
      await Share.share({
        url: shortUrl,
        message: productName ? `${productName} — ${shortUrl}` : shortUrl,
      });
    } catch (error) {
      Sentry.captureException(error);
    }
  }, [shortUrl, productName]);

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

  const screenTitle = productName?.trim() || "Edit product";

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: screenTitle,
          headerLeft: () => (
            <Button size="sm" variant="ghost" onPress={() => router.back()} disabled={isSaving}>
              <Text>Cancel</Text>
            </Button>
          ),
          headerRight: () => (
            <View className="flex-row gap-2">
              {isPublished && shortUrl ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onPress={() => void handleSharePress()}
                  disabled={isSaving}
                  testID="share-button"
                >
                  <Text>Share</Text>
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="ghost"
                onPress={handleReloadPress}
                disabled={isSaving}
                testID="reload-button"
              >
                <Text>Reload</Text>
              </Button>
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
      <View className="flex-row items-center gap-2 border-b border-border/70 px-4 py-2">
        <Text className="flex-1 text-sm text-muted" numberOfLines={1}>
          {screenTitle}
        </Text>
        <Badge variant={isPublished ? "default" : "secondary"} testID="status-badge">
          <Text>{isPublished ? "Published" : "Draft"}</Text>
        </Badge>
      </View>
      <EditorTabBar activeTab={activeTab} disabled={isSaving} />
      {loadError ? (
        <View className="flex-1 items-center justify-center gap-4 px-6" testID="webview-error-state">
          <Text className="text-center text-muted">{loadError}</Text>
          <Button size="sm" variant="outline" onPress={handleReloadPress} testID="retry-button">
            <Text>Retry</Text>
          </Button>
        </View>
      ) : (
        <View className="flex-1">
          <StyledWebView
            ref={webViewRef}
            source={{ uri: url }}
            className="flex-1 bg-transparent"
            webviewDebuggingEnabled
            incognito
            originWhitelist={["*"]}
            onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
            onMessage={handleMessage}
            onLoadEnd={() => setHasLoadedOnce(true)}
            onError={({ nativeEvent }) => {
              setLoadError(nativeEvent.description || "Failed to load product editor.");
            }}
            onHttpError={({ nativeEvent }) => {
              if (nativeEvent.statusCode >= 400) {
                setLoadError(`Couldn't load product editor (HTTP ${nativeEvent.statusCode}).`);
              }
            }}
            automaticallyAdjustContentInsets={false}
            keyboardDisplayRequiresUserAction={false}
            testID="product-edit-webview"
          />
          {!hasLoadedOnce ? (
            <View className="absolute inset-0 bg-body-bg" testID="initial-loading-overlay">
              <EditorSkeleton />
            </View>
          ) : null}
          {isSaving ? (
            <View className="absolute inset-0 items-center justify-center bg-black/40" testID="saving-overlay">
              <LoadingSpinner size="large" />
            </View>
          ) : null}
        </View>
      )}
    </Screen>
  );
}
