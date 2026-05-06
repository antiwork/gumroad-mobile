import type { FileUploadStatus as PhotoStatus } from "@/components/email-compose/use-file-upload";
import { LineIcon } from "@/components/icon";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Text } from "@/components/ui/text";
import { Pressable, View } from "react-native";

const labelFor: Record<PhotoStatus, string> = {
  idle: "",
  uploading_blob: "Preparing upload…",
  uploading_s3: "Uploading photo…",
  fetching_cdn_url: "Finalizing…",
  uploaded: "Photo attached",
  failed: "Upload failed",
};

export const PhotoAttachment = ({
  status,
  onRemove,
  onRetry,
}: {
  status: PhotoStatus;
  onRemove: () => void;
  onRetry?: () => void;
}) => {
  if (status === "idle") return null;

  const isLoading = status === "uploading_blob" || status === "uploading_s3" || status === "fetching_cdn_url";
  const isFailed = status === "failed";
  const isUploaded = status === "uploaded";

  return (
    <View className="mx-4 my-2 flex-row items-center gap-3 rounded border border-border bg-card p-3">
      {isLoading ? <LoadingSpinner size="small" /> : null}
      {isUploaded ? <LineIcon name="check-circle" size={20} className="text-accent" /> : null}
      {isFailed ? <LineIcon name="x-circle" size={20} className="text-destructive" /> : null}
      <Text className="flex-1 text-sm">{labelFor[status]}</Text>
      {isFailed && onRetry ? (
        <Pressable onPress={onRetry} accessibilityRole="button" hitSlop={8}>
          <Text className="text-sm underline">Retry</Text>
        </Pressable>
      ) : null}
      {(isUploaded || isFailed) ? (
        <Pressable onPress={onRemove} accessibilityRole="button" accessibilityLabel="Remove photo" hitSlop={8}>
          <Text className="text-sm underline">Remove</Text>
        </Pressable>
      ) : null}
    </View>
  );
};
