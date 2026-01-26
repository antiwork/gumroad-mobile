import { SalePurchase } from "@/components/dashboard/use-sales-analytics";
import { Text } from "@/components/ui/text";
import { Image, TouchableOpacity, View } from "react-native";
import { Badge } from "../ui/badge";

interface SaleItemProps {
  sale: SalePurchase;
  onPress: () => void;
}

export const SaleItem = ({ sale, onPress }: SaleItemProps) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="flex-row items-center gap-3 border-b border-border bg-background pr-4"
    >
      {sale.product_thumbnail_url ? (
        <Image source={{ uri: sale.product_thumbnail_url }} className="size-16 bg-body-bg" resizeMode="cover" />
      ) : (
        <View className="size-16 items-center justify-center bg-body-bg">
          <Text className="text-lg">📦</Text>
        </View>
      )}
      <View className="flex-1">
        <View className="flex-row items-center gap-1.5">
          <Text className="text-sm font-bold text-foreground" numberOfLines={1}>
            {sale.product_name}
          </Text>
          <StatusBadge sale={sale} />
        </View>
        <Text className="text-xs" numberOfLines={1}>
          {sale.email}
        </Text>
      </View>
      <View className="items-end gap-1">
        <Text className="text-sm font-bold">{sale.formatted_total_price}</Text>
        <Text className="text-xs">{sale.timestamp}</Text>
      </View>
    </TouchableOpacity>
  );
};

const StatusBadge = ({ sale }: { sale: SalePurchase }) => {
  if (sale.chargedback)
    return (
      <Badge variant="destructive">
        <Text>Chargedback</Text>
      </Badge>
    );
  if (sale.refunded)
    return (
      <Badge variant="outline">
        <Text>Refunded</Text>
      </Badge>
    );
  if (sale.partially_refunded)
    return (
      <Badge variant="outline">
        <Text>Partially refunded</Text>
      </Badge>
    );
  return null;
};
