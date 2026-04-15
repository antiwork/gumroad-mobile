import { LineIcon } from "@/components/icon";
import { useInstallment, usePurchase } from "@/components/library/use-purchases";
import { MiniAudioPlayer } from "@/components/mini-audio-player";
import { StyledImage } from "@/components/styled";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useAudioPlayerSync } from "@/components/use-audio-player-sync";
import { safeOpenURL } from "@/lib/open-url";
import { buildApiUrl } from "@/lib/request";
import * as Sentry from "@sentry/react-native";
import { File, Paths } from "expo-file-system";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { Asset } from "expo-asset";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView as BaseWebView } from "react-native-webview";
import { useCSSVariable } from "uniwind";

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
};

const audioExtensions = ["mp3", "m4a", "aac", "wav", "ogg", "flac"];
const videoExtensions = ["mp4", "m4v"];
const pdfExtensions = ["pdf"];

const getFileExtension = (name: string) => name.split(/\.(?=[^.]+$)/)[1]?.toLowerCase();

const isAudioFile = (file: { name: string; filegroup?: string }) => {
  const ext = getFileExtension(file.name);
  return file.filegroup === "audio" || (ext != null && audioExtensions.includes(ext));
};

const isVideoFile = (file: { name: string; filegroup?: string; streaming_url?: string }) => {
  const ext = getFileExtension(file.name);
  return file.filegroup === "video" || (ext != null && videoExtensions.includes(ext)) || !!file.streaming_url;
};

const isPdfFile = (file: { name: string }) => {
  const ext = getFileExtension(file.name);
  return ext != null && pdfExtensions.includes(ext);
};

type FileMediaType = "audio" | "video" | "pdf" | "other";

const getMediaType = (file: { name: string; filegroup?: string; streaming_url?: string }): FileMediaType => {
  if (isAudioFile(file)) return "audio";
  if (isVideoFile(file)) return "video";
  if (isPdfFile(file)) return "pdf";
  return "other";
};

const fileIconName = (mediaType: FileMediaType) => {
  switch (mediaType) {
    case "audio":
      return "music";
    case "video":
      return "play";
    case "pdf":
      return "file";
    default:
      return "file";
  }
};

const downloadUrl = (urlRedirectToken: string, productFileId: string) =>
  buildApiUrl(`/mobile/url_redirects/download/${urlRedirectToken}/${productFileId}`);

const downloadFile = (urlRedirectToken: string, productFileId: string) =>
  File.downloadFileAsync(downloadUrl(urlRedirectToken, productFileId), Paths.cache, {
    idempotent: true,
  });

const fontDataPromise = Promise.all(
  [
    { module: require("@/assets/fonts/ABCFavorit-Regular-custom.ttf"), weight: 400, style: "normal" },
    { module: require("@/assets/fonts/ABCFavorit-Bold-custom.ttf"), weight: 700, style: "normal" },
    { module: require("@/assets/fonts/ABCFavorit-RegularItalic-custom.ttf"), weight: 400, style: "italic" },
    { module: require("@/assets/fonts/ABCFavorit-BoldItalic-custom.ttf"), weight: 700, style: "italic" },
  ].map(async ({ module, weight, style }) => {
    const asset = Asset.fromModule(module);
    await asset.downloadAsync();
    if (!asset.localUri) throw new Error("Failed to load font asset");
    const file = new File(asset.localUri);
    return { weight, style, base64: await file.base64() };
  }),
);

export default function PostScreen() {
  const { id, purchaseId, subscriptionId, followerId } = useLocalSearchParams<{
    id: string;
    purchaseId?: string;
    subscriptionId?: string;
    followerId?: string;
  }>();
  const router = useRouter();
  const post = useInstallment(id, { purchaseId, subscriptionId, followerId });
  const purchase = usePurchase(post?.url_redirect_external_id);
  const webViewRef = useRef<BaseWebView>(null);
  const { playAudio, pauseAudio, activeResourceId, isPlaying } = useAudioPlayerSync(webViewRef);
  const { bottom } = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [bodyHeight, setBodyHeight] = useState(0);
  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null);
  const [fontFaces, setFontFaces] = useState("");

  const [foreground, bodyBg, fontFamily] = useCSSVariable(["--color-foreground", "--color-body-bg", "--font-sans"]);

  useEffect(() => {
    fontDataPromise
      .then((fonts) =>
        setFontFaces(
          fonts
            .map(
              (f) =>
                `@font-face { font-family: '${fontFamily}'; src: url(data:font/ttf;base64,${f.base64}) format('truetype'); font-weight: ${f.weight}; font-style: ${f.style}; }`,
            )
            .join("\n"),
        ),
      )
      .catch(Sentry.captureException);
  }, [fontFamily]);

  const htmlContent = post?.message
    ? `<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<style>
  ${fontFaces}
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
      if (!post?.url_redirect_external_id || !purchase?.url_redirect_token)
        throw new Error("Missing URL redirect token");
      const downloadedFile = await downloadFile(purchase.url_redirect_token, fileId);
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

  const handleAudioPress = async (fileId: string) => {
    try {
      if (activeResourceId === fileId && isPlaying) {
        await pauseAudio();
        return;
      }
      if (!post?.url_redirect_external_id || !purchase?.url_redirect_token) return;
      const allAudioFiles = post.files_data?.filter(isAudioFile) ?? [];
      const tracks = allAudioFiles.map((f) => ({
        uri: downloadUrl(purchase.url_redirect_token, f.id),
        resourceId: f.id,
        title: f.name ?? post.name,
        urlRedirectId: post.url_redirect_external_id,
        purchaseId: purchase.purchase_id,
      }));
      const file = allAudioFiles.find((f) => f.id === fileId);
      await playAudio({
        resourceId: fileId,
        resumeAt: file?.latest_media_location?.location,
        artist: post.creator_name,
        artistUrl: post.creator_profile_url,
        artwork: purchase.thumbnail_url,
        tracks,
      });
    } catch (error) {
      Sentry.captureException(error);
    }
  };

  const handleVideoPress = (fileId: string) => {
    if (!post?.url_redirect_external_id || !purchase?.url_redirect_token) return;
    const file = post.files_data?.find((f) => f.id === fileId);
    router.push({
      pathname: "/video-player",
      params: {
        uri: downloadUrl(purchase.url_redirect_token, fileId),
        streamingUrl: file?.streaming_url,
        title: post.name,
        urlRedirectId: post.url_redirect_external_id,
        productFileId: fileId,
        purchaseId: purchase.purchase_id,
        initialPosition: file?.latest_media_location?.location ?? undefined,
      },
    });
  };

  const handlePdfPress = (fileId: string) => {
    if (!post?.url_redirect_external_id || !purchase?.url_redirect_token) return;
    const file = post.files_data?.find((f) => f.id === fileId);
    router.push({
      pathname: "/pdf-viewer",
      params: {
        uri: downloadUrl(purchase.url_redirect_token, fileId),
        title: post.name,
        urlRedirectId: post.url_redirect_external_id,
        productFileId: fileId,
        purchaseId: purchase.purchase_id,
        initialPage: file?.latest_media_location?.location ?? undefined,
      },
    });
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
              const mediaType = getMediaType(file);
              return (
                <View key={file.id} className={`flex-row items-center gap-3 p-4 ${index > 0 ? "border-t border-border" : ""}`}>
                  <LineIcon name={fileIconName(mediaType)} size={20} className="text-foreground" />
                  <View className="flex-1">
                    <Text numberOfLines={1}>{fileName}</Text>
                    {extension ? <Text>{extension.toUpperCase()}</Text> : null}
                  </View>
                  <View className="flex-row gap-2">
                    <Button
                      variant="outline"
                      onPress={() => handleFileDownload(file.id)}
                      disabled={!purchase || downloadingFileId === file.id}
                    >
                      {downloadingFileId === file.id ? <LoadingSpinner size="small" /> : <Text>Download</Text>}
                    </Button>
                    {mediaType === "audio" && (
                      <Button onPress={() => handleAudioPress(file.id)} disabled={!purchase}>
                        <Text>{activeResourceId === file.id && isPlaying ? "Pause" : "Play"}</Text>
                      </Button>
                    )}
                    {mediaType === "video" && (
                      <Button onPress={() => handleVideoPress(file.id)} disabled={!purchase}>
                        <Text>Watch</Text>
                      </Button>
                    )}
                    {mediaType === "pdf" && (
                      <Button onPress={() => handlePdfPress(file.id)} disabled={!purchase}>
                        <Text>Read</Text>
                      </Button>
                    )}
                  </View>
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
