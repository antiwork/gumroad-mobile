import { Text } from "@/components/ui/text";
import { ReactNode } from "react";
import { View } from "react-native";
import { SolidIcon } from "../icon";

interface ChartContainerProps {
  title: string;
  selectedDate?: string;
  showChart: boolean;
  emptyMessage: string;
  children: ReactNode;
}

export const ChartContainer = ({ title, selectedDate, showChart, emptyMessage, children }: ChartContainerProps) => {
  return (
    <View className="mb-4 rounded border border-border bg-background p-4">
      <View className="mb-2 flex-row items-baseline justify-between">
        <Text className="text-sm font-bold">{title}</Text>
        {showChart && selectedDate && <Text className="text-xs text-muted">{selectedDate}</Text>}
      </View>
      {showChart ? (
        children
      ) : (
        <View className="h-38 flex-row items-center justify-center gap-2">
          <SolidIcon name="bar-chart-alt-2" className="text-muted" size={16} />
          <Text className="text-muted">{emptyMessage}</Text>
        </View>
      )}
    </View>
  );
};
