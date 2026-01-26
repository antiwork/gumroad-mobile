import { SalesTab } from "@/components/analytics/sales-tab";
import { TrafficTab } from "@/components/analytics/traffic-tab";
import { AnalyticsTimeRange } from "@/components/analytics/use-analytics-by-date";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import * as Haptics from "expo-haptics";
import { useState } from "react";
import { View } from "react-native";

type TabType = "sales" | "traffic";

const TabButton = ({
  label,
  value,
  selected,
  onSelect,
}: {
  label: string;
  value: TabType;
  selected: boolean;
  onSelect: (value: TabType) => void;
}) => {
  const handlePress = () => {
    Haptics.selectionAsync();
    onSelect(value);
  };

  return (
    <Button variant={selected ? "outline" : "ghost"} size="sm" className="rounded-full" onPress={handlePress}>
      <Text>{label}</Text>
    </Button>
  );
};

const TimeRangeButton = ({
  label,
  value,
  selected,
  onSelect,
}: {
  label: string;
  value: AnalyticsTimeRange;
  selected: boolean;
  onSelect: (value: AnalyticsTimeRange) => void;
}) => {
  const handlePress = () => {
    Haptics.selectionAsync();
    onSelect(value);
  };

  return (
    <Button variant={selected ? "outline" : "ghost"} size="sm" className="rounded-full" onPress={handlePress}>
      <Text>{label}</Text>
    </Button>
  );
};

export default function Analytics() {
  const [activeTab, setActiveTab] = useState<TabType>("sales");
  const [timeRange, setTimeRange] = useState<AnalyticsTimeRange>("1w");

  return (
    <Screen>
      <View className="flex-row justify-center gap-2 border-b border-border p-4">
        <TabButton label="Sales" value="sales" selected={activeTab === "sales"} onSelect={setActiveTab} />
        <TabButton label="Referrers" value="traffic" selected={activeTab === "traffic"} onSelect={setActiveTab} />
      </View>

      <View className="flex-row justify-center gap-2 p-4">
        <TimeRangeButton label="1W" value="1w" selected={timeRange === "1w"} onSelect={setTimeRange} />
        <TimeRangeButton label="1M" value="1m" selected={timeRange === "1m"} onSelect={setTimeRange} />
        <TimeRangeButton label="1Y" value="1y" selected={timeRange === "1y"} onSelect={setTimeRange} />
        <TimeRangeButton label="All" value="all" selected={timeRange === "all"} onSelect={setTimeRange} />
      </View>

      {activeTab === "sales" ? <SalesTab timeRange={timeRange} /> : <TrafficTab timeRange={timeRange} />}
    </Screen>
  );
}
