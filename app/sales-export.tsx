import { StyledWebView } from "@/components/styled";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import { env } from "@/lib/env";
import { safeOpenURL } from "@/lib/open-url";
import { getExportAllSalesUrl } from "@/lib/sales-export";
import * as Sentry from "@sentry/react-native";
import { File, Paths } from "expo-file-system";
import { Stack } from "expo-router";
import * as Sharing from "expo-sharing";
import { useCallback, useMemo, useState } from "react";
import { Alert, View } from "react-native";

const gumroadOrigin = new URL(env.EXPO_PUBLIC_GUMROAD_URL).origin;

const isWebUrl = (url: string) => /^https?:\/\//.test(url);

const isGumroadUrl = (url: string) => {
  try {
    return new URL(url).origin === gumroadOrigin;
  } catch {
    return false;
  }
};

const SALES_CSV_FILE_NAME = "sales.csv";
const HTML_TAG_OPEN_BYTE = "<".charCodeAt(0);
const LARGE_EXPORT_MESSAGE = "Large exports arrive by email.";

const downloadSalesExportFile = async (url: string) => {
  const file = new File(Paths.cache, SALES_CSV_FILE_NAME);
  await File.downloadFileAsync(url, file, { idempotent: true });

  const handle = file.open();
  let firstByte: number | undefined;
  try {
    firstByte = handle.readBytes(1)[0];
  } finally {
    handle.close();
  }

  const failureMessage =
    firstByte === undefined
      ? "Failed to download file"
      : firstByte === HTML_TAG_OPEN_BYTE
        ? LARGE_EXPORT_MESSAGE
        : null;

  if (failureMessage !== null) {
    try {
      file.delete();
    } catch {}
    throw new Error(failureMessage);
  }
  return file;
};

export default function SalesExportScreen() {
  const { isLoading, accessToken } = useAuth();
  const [isDownloading, setIsDownloading] = useState(false);
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

  const downloadSalesExport = useCallback(async () => {
    setIsDownloading(true);
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) throw new Error("Sharing is not available on this device");
      const downloaded = await downloadSalesExportFile(url);
      await Sharing.shareAsync(downloaded.uri, {
        UTI: "public.comma-separated-values-text",
        mimeType: "text/csv",
        dialogTitle: "Export all sales",
      });
    } catch (error) {
      if (error instanceof Error && error.message === LARGE_EXPORT_MESSAGE) {
        Alert.alert("Large export", LARGE_EXPORT_MESSAGE);
      } else {
        Sentry.captureException(error);
        Alert.alert("Download failed", error instanceof Error ? error.message : "Failed to download file");
      }
    } finally {
      setIsDownloading(false);
    }
  }, [url]);

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
      <View className="border-t border-border bg-body-bg p-4">
        <Button onPress={downloadSalesExport} disabled={isDownloading}>
          <Text>{isDownloading ? "Downloading..." : "Download CSV"}</Text>
        </Button>
      </View>
      {isDownloading && (
        <View className="absolute inset-0 items-center justify-center bg-black/50">
          <LoadingSpinner size="large" />
        </View>
      )}
    </Screen>
  );
}
