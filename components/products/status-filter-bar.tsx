import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { View } from "react-native";

export type StatusFilter = "all" | "published" | "draft";

const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "published", label: "Published" },
  { id: "draft", label: "Drafts" },
];

export const StatusFilterBar = ({
  value,
  onChange,
}: {
  value: StatusFilter;
  onChange: (filter: StatusFilter) => void;
}) => (
  <View className="flex-row gap-2" testID="status-filter-bar">
    {FILTERS.map((filter) => {
      const isActive = value === filter.id;
      return (
        <Button
          key={filter.id}
          onPress={() => onChange(filter.id)}
          variant={isActive ? "outline" : "ghost"}
          size="sm"
          className="rounded-full"
          testID={`status-filter-${filter.id}`}
        >
          <Text className={isActive ? "text-foreground" : "text-muted"}>{filter.label}</Text>
        </Button>
      );
    })}
  </View>
);
