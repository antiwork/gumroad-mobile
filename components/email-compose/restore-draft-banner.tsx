import type { Draft } from "@/components/email-compose/use-email-draft";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { View } from "react-native";

const formatRelativeTime = (savedAt: string): string => {
  const minutes = Math.max(1, Math.round((Date.now() - new Date(savedAt).getTime()) / 60_000));
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
};

export const RestoreDraftBanner = ({
  draft,
  onContinue,
  onDiscard,
}: {
  draft: Draft;
  onContinue: () => void;
  onDiscard: () => void;
}) => (
  <Card className="mx-4 my-2">
    <CardContent>
      <Text className="text-sm font-medium">Continue your draft?</Text>
      <Text className="mt-1 text-xs text-muted-foreground">
        {draft.title ? `"${draft.title}" — ` : ""}saved {formatRelativeTime(draft.savedAt)}
      </Text>
      <View className="mt-3 flex-row justify-end gap-2">
        <Button variant="ghost" size="sm" onPress={onDiscard}>
          <Text>Discard</Text>
        </Button>
        <Button size="sm" onPress={onContinue}>
          <Text>Continue</Text>
        </Button>
      </View>
    </CardContent>
  </Card>
);
