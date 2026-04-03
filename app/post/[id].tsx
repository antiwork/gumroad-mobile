import { LineIcon } from "@/components/icon";
import { useInstallment } from "@/components/library/use-purchases";
import { MiniAudioPlayer } from "@/components/mini-audio-player";
import { StyledImage } from "@/components/styled";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { safeOpenURL } from "@/lib/open-url";
import { buildApiUrl } from "@/lib/request";
import * as Sentry from "@sentry/react-native";
import { File, Paths } from "expo-file-system";
import { Stack, useLocalSearchParams } from "expo-router";
import * as Sharing from "expo-sharing";
import { useCallback, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView as BaseWebView } from "react-native-webview";
import { useCSSVariable } from "uniwind";

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
};

const downloadFile = (urlRedirectToken: string, productFileId: string) =>
  File.downloadFileAsync(
    buildApiUrl(`/mobile/url_redirects/download/${urlRedirectToken}/${productFileId}`),
    Paths.cache,
    {
      idempotent: true,
    },
  );

export default function PostScreen() {
  const { id, purchaseId, subscriptionId, followerId } = useLocalSearchParams<{
    id: string;
    purchaseId?: string;
    subscriptionId?: string;
    followerId?: string;
  }>();
  const post = useInstallment(id, { purchaseId, subscriptionId, followerId });
  const { bottom } = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [bodyHeight, setBodyHeight] = useState(0);
  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null);
  const webViewRef = useRef<BaseWebView>(null);

  const [foreground, bodyBg, fontFamily] = useCSSVariable(["--color-foreground", "--color-body-bg", "--font-sans"]);

  const htmlContent = post?.message
    ? `<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: '${fontFamily}', system-ui, sans-serif; font-size: 16px; line-height: 1.6; color: ${foreground}; background: ${bodyBg}; padding: 0; overflow-wrap: break-word; word-wrap: break-word; }
  img { max-width: 100%; height: auto; }
  a { color: ${foreground}; }
  p { margin-bottom: 12px; }
  h1, h2, h3, h4, h5, h6 { margin-bottom: 8px; margin-top: 16px; }
</style></head>
<body>${post.message}</body></html>`
    : null;

  const handleHeightMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    const height = Number(event.nativeEvent.data);
    if (!isNaN(height)) setBodyHeight(height);
  }, []);

  const handleFileDownload = async (fileId: string) => {
    try {
      setDownloadingFileId(fileId);
      if (!post?.url_redirect_external_id) throw new Error("Missing URL redirect token");
      const downloadedFile = await downloadFile(post.url_redirect_external_id, fileId);
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) throw new Error("Sharing is not available on this device");
      await Sharing.shareAsync(downloadedFile.uri);
    } catch (error) {
      Sentry.captureException(error);
      Alert.alert("Download Failed", error instanceof Error ? error.message : "Failed to download file");
    } finally {
      setDownloadingFileId(null);
    }
  };

  const handleCreatorPress = () => {
    if (post?.creator_profile_url) safeOpenURL(post.creator_profile_url);
  };

  const handleCtaPress = () => {
    if (post?.call_to_action_url) safeOpenURL(post.call_to_action_url);
  };

  if (!post) {
    return (
      <Screen>
        <Stack.Screen options={{ title: "" }} />
        <View className="flex-1 items-center justify-center bg-body-bg">
          <LoadingSpinner size="large" />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: "" }} />
      <ScrollView className="flex-1 bg-body-bg" contentContainerStyle={{ paddingBottom: bottom + 16 }}>
        <View className="px-4 py-6">
          <Text className="text-2xl">{post.name}</Text>
          <Pressable className="mt-3 mb-2 flex-row items-center gap-3" onPress={handleCreatorPress}>
            {post.creator_profile_picture_url ? (
              <StyledImage
                source={{ uri: post.creator_profile_picture_url }}
                className="size-8 rounded-full border border-foreground bg-muted"
              />
            ) : null}
            <View className="flex-1">
              <Text className="text-sm">{post.creator_name}</Text>
              <Text className="text-sm">{formatDate(post.published_at)}</Text>
            </View>
          </Pressable>

          {htmlContent && (
            <View style={{ height: bodyHeight, marginTop: 16 }}>
              <BaseWebView
                ref={webViewRef}
                source={{ html: htmlContent }}
                style={{ height: bodyHeight, width: width - 32, backgroundColor: "transparent" }}
                scrollEnabled={false}
                showsVerticalScrollIndicator={false}
                onMessage={handleHeightMessage}
                injectedJavaScript={`
                  const sendHeight = () => window.ReactNativeWebView.postMessage(String(document.body.scrollHeight));
                  sendHeight();
                  new MutationObserver(sendHeight).observe(document.body, { childList: true, subtree: true });
                  new ResizeObserver(sendHeight).observe(document.body);
                  true;
                `}
              />
            </View>
          )}

          {post.call_to_action_text && post.call_to_action_url && (
            <Button className="mt-4" onPress={handleCtaPress}>
              <Text>{post.call_to_action_text}</Text>
            </Button>
          )}
        </View>

        {post.files_data && post.files_data.length > 0 && (
          <View className="mx-4 rounded border border-border bg-background">
            {post.files_data.map((file, index) => {
              const [fileName, extension] = file.name.split(/\.(?=[^.]+$)/);
              return (
                <View key={file.id} className={`gap-4 p-4 ${index > 0 ? "border-t border-border" : ""}`}>
                  <View className="flex-1 flex-row items-center gap-3">
                    <LineIcon name="file" size={20} className="text-foreground" />
                    <View className="flex-1">
                      <Text numberOfLines={1}>{fileName}</Text>
                      {extension ? <Text>{extension.toUpperCase()}</Text> : null}
                    </View>
                  </View>
                  <Button
                    className="self-end"
                    variant="outline"
                    onPress={() => handleFileDownload(file.id)}
                    disabled={downloadingFileId === file.id}
                  >
                    {downloadingFileId === file.id ? <LoadingSpinner size="small" /> : <Text>Download</Text>}
                  </Button>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
      <View className="bg-body-bg">
        <MiniAudioPlayer />
      </View>
    </Screen>
  );
}
