import { LineIcon, type LineIconName } from "@/components/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { Platform, Pressable, View } from "react-native";

type BannerVariant = "error" | "info" | "warning";

const variantClasses: Record<BannerVariant, string> = {
  error: "bg-destructive/10 border-destructive",
  info: "bg-muted/10 border-border",
  warning: "bg-accent/10 border-accent",
};

const variantIcons: Record<BannerVariant, LineIconName> = {
  error: "x-circle",
  info: "info-circle",
  warning: "info-circle",
};

export const Banner = ({
  variant = "info",
  message,
  actionLabel,
  onAction,
}: {
  variant?: BannerVariant;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) => (
  <View
    accessibilityRole={variant === "error" ? "alert" : undefined}
    accessibilityLiveRegion={variant === "error" ? "assertive" : "polite"}
    className={cn("mx-4 my-2 flex-row items-start gap-3 rounded border p-3", variantClasses[variant])}
    style={Platform.select({ ios: { borderCurve: "continuous" }, default: undefined })}
  >
    <LineIcon
      name={variantIcons[variant]}
      size={18}
      className="text-foreground"
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
    <View className="flex-1">
      <Text selectable className="text-sm">
        {message}
      </Text>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          hitSlop={8}
          className="mt-2 self-start"
        >
          <Text className="text-sm underline">{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  </View>
);
