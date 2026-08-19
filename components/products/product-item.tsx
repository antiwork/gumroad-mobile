import { SellerProduct } from "@/components/products/use-products";
import { StyledImage as Image } from "@/components/styled";
import { Badge } from "@/components/ui/badge";
import { Text } from "@/components/ui/text";
import { TouchableOpacity, View } from "react-native";

const statusLabel = (status: SellerProduct["status"]) => {
  if (status === "unpublished") return "Unpublished";
  if (status === "preorder") return "Preorder";
  return null;
};

export const ProductItem = ({
  product,
  onPress,
  onLongPress,
}: {
  product: SellerProduct;
  onPress: () => void;
  onLongPress?: () => void;
}) => {
  const label = statusLabel(product.status);

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={product.name}
      onPress={onPress}
      onLongPress={onLongPress}
      className="flex-row items-center gap-3 border-b border-border bg-background pr-4"
    >
      {product.thumbnail_url ? (
        <Image
          source={{ uri: product.thumbnail_url }}
          className="size-16 bg-body-bg"
          contentFit="cover"
          autoplay={false}
        />
      ) : (
        <View className="size-16 items-center justify-center bg-body-bg">
          <Text className="text-lg">📦</Text>
        </View>
      )}
      <View className="min-w-0 flex-1 py-3">
        <View className="flex-row items-center gap-1.5">
          <Text className="shrink text-sm font-bold text-foreground" numberOfLines={1}>
            {product.name}
          </Text>
          {label ? (
            <Badge variant="outline">
              <Text>{label}</Text>
            </Badge>
          ) : null}
        </View>
        <Text className="text-xs text-muted" numberOfLines={1}>
          {product.price_formatted}
        </Text>
      </View>
    </TouchableOpacity>
  );
};
