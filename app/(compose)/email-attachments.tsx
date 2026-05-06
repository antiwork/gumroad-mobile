import type { Attachment } from "@/components/email-compose/compose-context";
import { useCompose } from "@/components/email-compose/compose-context";
import type { FileAsset } from "@/components/email-compose/use-file-upload";
import { useFileUpload } from "@/components/email-compose/use-file-upload";
import { LineIcon, type LineIconName } from "@/components/icon";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { formatBytes } from "@/lib/format-bytes";
import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";
import { useCallback, useState } from "react";
import { Alert, FlatList, Pressable, View } from "react-native";

const SOFT_WARN_BYTES = 10 * 1024 * 1024;

const iconForMime = (mime: string): LineIconName => {
  if (mime.startsWith("image/")) return "image";
  return "file";
};

const confirmLargeFile = (filename: string, byteSize: number): Promise<boolean> =>
  new Promise((resolve) => {
    Alert.alert(
      "Large file",
      `"${filename}" is ${formatBytes(byteSize)}. Upload may take a while.`,
      [
        { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
        { text: "Upload", onPress: () => resolve(true) },
      ],
    );
  });

export default function EmailAttachmentsScreen() {
  const { attachments, setAttachments } = useCompose();
  const fileUpload = useFileUpload();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPicking, setIsPicking] = useState(false);

  const handlePickFiles = useCallback(async () => {
    setErrorMessage(null);
    const picked = await DocumentPicker.getDocumentAsync({
      type: ["image/*", "application/pdf"],
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (picked.canceled || !picked.assets?.length) return;

    setIsPicking(true);
    try {
      for (const asset of picked.assets) {
        const size = asset.size ?? 0;
        if (size > SOFT_WARN_BYTES) {
          const ok = await confirmLargeFile(asset.name, size);
          if (!ok) continue;
        }
        const fileAsset: FileAsset = {
          uri: asset.uri,
          name: asset.name,
          size: asset.size ?? null,
          mimeType: asset.mimeType ?? null,
        };
        const result = await fileUpload.upload(fileAsset);
        if (result) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setAttachments((prev) => {
            const next: Attachment = {
              cdnUrl: result.cdnUrl,
              filename: result.filename,
              byteSize: result.byteSize,
              mimeType: result.mimeType,
              signedId: result.signedId,
              position: prev.length,
            };
            return [...prev, next];
          });
        } else {
          setErrorMessage(`Couldn't upload "${asset.name}". Tap Attach files to retry.`);
        }
      }
    } finally {
      setIsPicking(false);
    }
  }, [fileUpload, setAttachments]);

  const handleRemove = useCallback(
    (cdnUrl: string) => {
      setAttachments((prev) =>
        prev.filter((a) => a.cdnUrl !== cdnUrl).map((a, i) => ({ ...a, position: i })),
      );
    },
    [setAttachments],
  );

  return (
    <Screen>
      {errorMessage ? <Banner variant="error" message={errorMessage} /> : null}

      <FlatList<Attachment>
        data={attachments}
        keyExtractor={(item) => item.cdnUrl}
        renderItem={({ item }) => (
          <View className="flex-row items-center gap-3 border-b border-border px-4 py-3">
            <LineIcon name={iconForMime(item.mimeType)} size={22} className="text-foreground" />
            <View className="flex-1">
              <Text className="text-base text-foreground" numberOfLines={1}>{item.filename}</Text>
              <Text className="text-xs text-muted-foreground">{formatBytes(item.byteSize)}</Text>
            </View>
            <Pressable
              onPress={() => handleRemove(item.cdnUrl)}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${item.filename}`}
              hitSlop={12}
            >
              <LineIcon name="x" size={20} className="text-muted-foreground" />
            </Pressable>
          </View>
        )}
        ListEmptyComponent={
          <View className="items-center justify-center py-16 px-8">
            <Text className="text-base font-medium text-foreground">No attachments yet</Text>
            <Text className="mt-1 text-sm text-muted-foreground text-center">
              Attach PDFs or images to send as downloads.
            </Text>
          </View>
        }
        ListFooterComponent={
          <View className="px-4 pt-4 pb-8">
            <Button variant="outline" onPress={handlePickFiles} disabled={isPicking}>
              {isPicking ? (
                <LoadingSpinner size="small" />
              ) : (
                <LineIcon name="paperclip" size={16} className="text-foreground" />
              )}
              <Text>{isPicking ? "Uploading…" : "Attach files"}</Text>
            </Button>
            <Text className="mt-3 text-xs text-muted-foreground text-center">
              Images and PDFs. Files over 10 MB will warn before uploading.
            </Text>
          </View>
        }
      />
    </Screen>
  );
}
