import { LineIcon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Text } from "@/components/ui/text";
import { formatStatNumber, formatStatPercent } from "@/lib/format-stat";
import { safeOpenURL } from "@/lib/open-url";
import { View } from "react-native";
import type { EmailRow } from "./types";

const formatTimestamp = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

type StatRowProps = {
  label: string;
  value: string;
  detail?: string;
};

const StatRow = ({ label, value, detail }: StatRowProps) => (
  <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
    <Text className="text-sm text-muted-foreground">{label}</Text>
    <View className="items-end">
      <Text className="text-base font-medium text-foreground">{value}</Text>
      {detail ? <Text className="text-xs text-muted-foreground">{detail}</Text> : null}
    </View>
  </View>
);

const buildRow = (label: string, count: number | null, rate: number | null | undefined, sendEmails: boolean): StatRowProps => {
  if (!sendEmails) return { label, value: "n/a" };
  return {
    label,
    value: formatStatNumber(count),
    detail: rate != null ? formatStatPercent(rate) : undefined,
  };
};

export const EmailDetailSheet = ({
  row,
  onClose,
}: {
  row: EmailRow | null;
  onClose: () => void;
}) => (
  <Sheet open={!!row} onOpenChange={(next) => { if (!next) onClose(); }}>
    <SheetHeader onClose={onClose}>
      <SheetTitle numberOfLines={2}>{row?.name || "Untitled"}</SheetTitle>
    </SheetHeader>
    <SheetContent>
      {row ? (
        <View className="pt-2">
          <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
            <Text className="text-sm text-muted-foreground">Sent</Text>
            <Text className="text-base font-medium text-foreground">{formatTimestamp(row.published_at)}</Text>
          </View>
          <StatRow {...buildRow("Emailed", row.sent_count, undefined, row.send_emails)} />
          <StatRow {...buildRow("Opened", row.open_count, row.open_rate, row.send_emails)} />
          <StatRow {...buildRow("Clicks", row.click_count, row.click_rate, row.send_emails)} />
          <StatRow label="Views" value={formatStatNumber(row.view_count)} />

          {row.full_url ? (
            <View className="px-4 py-4">
              <Button
                variant="outline"
                onPress={() => safeOpenURL(row.full_url!)}
                testID="email-view-post-button"
              >
                <Text>View post</Text>
                <LineIcon name="link" size={16} className="text-foreground" />
              </Button>
            </View>
          ) : null}
        </View>
      ) : null}
    </SheetContent>
  </Sheet>
);
