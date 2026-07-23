import { SalesTab } from "@/components/analytics/sales-tab";
import { TrafficTab } from "@/components/analytics/traffic-tab";
import { AnalyticsTimeRange } from "@/components/analytics/use-analytics-by-date";
import { ExportAllSalesButton } from "@/components/export-all-sales-button";
import { GettingStartedPlaceholder } from "@/components/getting-started-placeholder";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import { useState } from "react";
import { View } from "react-native";

type TabType = "sales" | "traffic";

const TabButton = <ValueType extends string>({
  label,
  value,
  selected,
  onSelect,
}: {
  label: string;
  value: ValueType;
  selected: boolean;
  onSelect: (value: ValueType) => void;
}) => (
  <Button variant={selected ? "outline" : "ghost"} size="sm" className="rounded-full" onPress={() => onSelect(value)}>
    <Text>{label}</Text>
  </Button>
);

export default function Analytics() {
  const { isCreator } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>("sales");
  const [timeRange, setTimeRange] = useState<AnalyticsTimeRange>("1w");

  if (!isCreator) {
    return (
      <Screen>
        <GettingStartedPlaceholder message="You don't have any sales yet. Once you do, you'll see them here, along with powerful data that can help you see what's working, and what could be working better." />
      </Screen>
    );
  }

  return (
    <Screen>
      <View className="flex-row justify-center gap-2 border-b border-border p-4">
        <TabButton<TabType> label="Sales" value="sales" selected={activeTab === "sales"} onSelect={setActiveTab} />
        <TabButton<TabType>
          label="Referrers"
          value="traffic"
          selected={activeTab === "traffic"}
          onSelect={setActiveTab}
        />
      </View>

      <View className="gap-3 p-4">
        <View className="flex-row justify-center gap-2">
          <TabButton<AnalyticsTimeRange> label="1D" value="1d" selected={timeRange === "1d"} onSelect={setTimeRange} />
          <TabButton<AnalyticsTimeRange> label="1W" value="1w" selected={timeRange === "1w"} onSelect={setTimeRange} />
          <TabButton<AnalyticsTimeRange> label="1M" value="1m" selected={timeRange === "1m"} onSelect={setTimeRange} />
          <TabButton<AnalyticsTimeRange> label="1Y" value="1y" selected={timeRange === "1y"} onSelect={setTimeRange} />
        </View>
        <ExportAllSalesButton className="self-center" />
      </View>

      {activeTab === "sales" ? <SalesTab timeRange={timeRange} /> : <TrafficTab timeRange={timeRange} />}
    </Screen>
  );
}
