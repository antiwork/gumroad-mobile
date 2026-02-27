import { usePurchases } from "@/app/(tabs)/library";
import { ContentPageNav } from "@/components/content-page-nav";
import { MiniAudioPlayer } from "@/components/mini-audio-player";
import { StyledWebView } from "@/components/styled";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Screen } from "@/components/ui/screen";
import { useAudioPlayerSync } from "@/components/use-audio-player-sync";
import { useWebViewMessage } from "@/components/use-webview-message";
import { useAuth } from "@/lib/auth-context";
import { env } from "@/lib/env";
import { buildApiUrl } from "@/lib/request";
import { File, Paths } from "expo-file-system";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { useCallback, useMemo, useRef, useState } from "react";
import { Alert, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView as BaseWebView } from "react-native-webview";

// See antiwork/gumroad:app/javascript/components/Download/Interactions.tsx
type ClickPayload = {
  resourceId: string;
  isDownload: boolean;
  isPost: boolean;
  type?: string | null;
  extension?: string | null;
  isPlaying?: "true" | "false" | null;
  resumeAt?: string | null;
  contentLength?: string | null;
};

type TocPage = {
  page_id: string;
  title: string | null;
};

type TocDataPayload = {
  pages: TocPage[];
  activePageIndex: number;
};

const downloadUrl = (token: string, productFileId: string) =>
  buildApiUrl(`/mobile/url_redirects/download/${token}/${productFileId}`);

const downloadFile = (token: string, productFileId: string) =>
  File.downloadFileAsync(downloadUrl(token, productFileId), Paths.cache, {
    idempotent: true,
  });

const shareFile = async (uri: string) => {
  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) throw new Error("Sharing is not available on this device");
  await Sharing.shareAsync(uri);
};

export default function DownloadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [isDownloading, setIsDownloading] = useState(false);
  const [tocPages, setTocPages] = useState<TocPage[]>([]);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const { data: purchases = [] } = usePurchases();
  const router = useRouter();
  const { isLoading, accessToken } = useAuth();
  const webViewRef = useRef<BaseWebView>(null);

  const purchase = purchases.find((p) => p.url_redirect_token === id);
  const url = `${env.EXPO_PUBLIC_GUMROAD_URL}/d/${id}?display=expo_app&access_token=${accessToken}&mobile_token=${env.EXPO_PUBLIC_MOBILE_TOKEN}`;

  const { pauseAudio, playAudio } = useAudioPlayerSync(webViewRef);
  const { bottom } = useSafeAreaInsets();

  const handlePageChange = useCallback(
    (pageIndex: number) => {
      webViewRef.current?.postMessage(JSON.stringify({ type: "mobileAppPageChange", payload: { pageIndex } }));
    },
    [],
  );

  const handleClick = useCallback(
    async (payload: unknown) => {
      const { resourceId, isDownload, type, extension, isPlaying, resumeAt, contentLength } =
        payload as ClickPayload;

      const fileData = purchase?.file_data?.find((f) => f.id === resourceId);

      if (extension === "PDF" && !isDownload) {
        router.push({
          pathname: "/pdf-viewer",
          params: {
            uri: downloadUrl(id, resourceId),
            title: purchase?.name,
            urlRedirectId: id,
            productFileId: resourceId,
            purchaseId: purchase?.purchase_id,
            initialPage: resumeAt,
          },
        });
        return;
      }
      if (type === "audio" && !isDownload) {
        if (isPlaying === "true") {
          await pauseAudio();
        } else {
          await playAudio({
            uri: downloadUrl(id, resourceId),
            resourceId,
            resumeAt: resumeAt ? Number(resumeAt) : undefined,
            title: fileData?.name ?? purchase?.name,
            artist: purchase?.creator_name,
            artwork: purchase?.thumbnail_url,
            urlRedirectId: id,
            purchaseId: purchase?.purchase_id,
            contentLength: contentLength ? Number(contentLength) : undefined,
          });
        }
        return;
      }
      if (fileData?.filegroup === "video" && !isDownload) {
        router.push({
          pathname: "/video-player",
          params: {
            uri: downloadUrl(id, resourceId),
            streamingUrl: purchase?.file_data?.find((f) => f.id === resourceId)?.streaming_url,
            title: purchase?.name,
            urlRedirectId: id,
            productFileId: resourceId,
            purchaseId: purchase?.purchase_id,
            initialPosition: resumeAt ?? undefined,
          },
        });
        return;
      }

      try {
        setIsDownloading(true);
        const downloadedFile = await downloadFile(id, resourceId);
        await shareFile(downloadedFile.uri);
      } catch (error) {
        console.error("Download failed:", error);
        Alert.alert("Download failed", error instanceof Error ? error.message : "Failed to download file");
      } finally {
        setIsDownloading(false);
      }
    },
    [id, purchase, router, pauseAudio, playAudio],
  );

  const handleTocData = useCallback((payload: unknown) => {
    const { pages, activePageIndex } = payload as TocDataPayload;
    setTocPages(pages);
    setActivePageIndex(activePageIndex);
  }, []);

  const messageHandlers = useMemo(
    () => [
      { type: "click", handler: handleClick },
      { type: "tocData", handler: handleTocData },
    ],
    [handleClick, handleTocData],
  );

  const handleMessage = useWebViewMessage(messageHandlers);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-body-bg">
        <LoadingSpinner size="large" />
      </View>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: purchase?.name ?? "" }} />
      <StyledWebView
        ref={webViewRef}
        source={{ uri: url }}
        className="flex-1 bg-transparent"
        webviewDebuggingEnabled
        pullToRefreshEnabled
        mediaPlaybackRequiresUserAction={false}
        originWhitelist={["*"]}
        onMessage={handleMessage}
      />
      {isDownloading && (
        <View className="absolute inset-0 items-center justify-center bg-black/50">
          <LoadingSpinner size="large" />
        </View>
      )}
      {tocPages.length > 0 && (
        <ContentPageNav pages={tocPages} activePageIndex={activePageIndex} onPageChange={handlePageChange} />
      )}
      <View className="bg-body-bg" style={{ paddingBottom: bottom }}>
        <MiniAudioPlayer />
      </View>
    </Screen>
  );
}
