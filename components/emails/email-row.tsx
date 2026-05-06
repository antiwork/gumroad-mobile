import { Text } from "@/components/ui/text";
import { Pressable, View } from "react-native";
import type { EmailRow } from "./types";

const formatDate = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

const formatStat = (n: number | null | undefined) => {
  if (n == null) return "--";
  return n.toLocaleString();
};

const formatPct = (rate: number | null | undefined) => {
  if (rate == null) return "--";
  return `${Math.round(rate * 100)}%`;
};

const buildSummary = (row: EmailRow) => {
  const date = formatDate(row.published_at);
  if (row.send_emails) {
    return `${date} · ${formatStat(row.sent_count)} sent · ${formatPct(row.open_rate)} opened`;
  }
  return `${date} · ${formatStat(row.view_count)} views`;
};

export const EmailRowCard = ({
  row,
  onPress,
}: {
  row: EmailRow;
  onPress: (row: EmailRow) => void;
}) => (
  <Pressable
    onPress={() => onPress(row)}
    accessibilityRole="button"
    accessibilityLabel={`${row.name}, ${buildSummary(row)}`}
    testID={`email-row-${row.external_id}`}
    className="border-b border-border px-4 py-4"
  >
    <Text className="text-base font-medium text-foreground" numberOfLines={1}>
      {row.name || "Untitled"}
    </Text>
    <Text className="mt-1 text-sm text-muted-foreground" numberOfLines={1}>
      {buildSummary(row)}
    </Text>
  </Pressable>
);
