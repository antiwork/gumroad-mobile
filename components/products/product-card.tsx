import { LineIcon } from "@/components/icon";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { ProductModel } from "@/lib/product-api";
import { Image, Pressable, View } from "react-native";

export const ProductCard = ({
  product,
  onPress,
  isFirst,
}: {
  product: ProductModel;
  onPress: () => void;
  isFirst: boolean;
}) => {
  const subtitle = product.customSummary || product.description;

  return (
    <Pressable
      onPress={onPress}
      className={`mx-4 mb-3${isFirst ? " mt-3" : ""}`}
      testID={`product-card-${product.id}`}
    >
      <Card className="rounded-xl">
        <CardContent className="p-3">
          <View className="flex-row gap-3">
            {product.thumbnailUrl ? (
              <Image source={{ uri: product.thumbnailUrl }} className="size-16 rounded-lg bg-muted" resizeMode="cover" />
            ) : (
              <View className="size-16 items-center justify-center rounded-lg bg-muted">
                <LineIcon name="image" size={20} className="text-muted" />
              </View>
            )}
            <View className="flex-1 gap-1.5">
              <View className="flex-row items-start justify-between gap-2">
                <Text className="flex-1 text-base font-bold" numberOfLines={1}>
                  {product.name}
                </Text>
                <Badge variant={product.published ? "default" : "secondary"}>
                  <Text>{product.published ? "Published" : "Draft"}</Text>
                </Badge>
              </View>
              {product.shortUrl ? (
                <Text className="text-xs text-muted" numberOfLines={1}>
                  {product.shortUrl}
                </Text>
              ) : null}
              {subtitle ? (
                <Text className="text-xs text-muted" numberOfLines={2}>
                  {subtitle}
                </Text>
              ) : null}
              {product.tags.length > 0 ? (
                <Text className="text-[11px] text-muted" numberOfLines={1}>
                  {product.tags.slice(0, 2).join(" • ")}
                </Text>
              ) : null}
              <View className="mt-1 flex-row items-center justify-between">
                <Text className="text-xs text-muted">{product.salesCount} sales</Text>
                <View className="flex-row items-center gap-2">
                  {product.customizablePrice ? (
                    <Badge variant="outline">
                      <Text>PWYW</Text>
                    </Badge>
                  ) : null}
                  <Text className="text-sm font-bold">{product.formattedPrice}</Text>
                  <LineIcon name="chevron-right" size={16} className="text-muted" />
                </View>
              </View>
            </View>
          </View>
        </CardContent>
      </Card>
    </Pressable>
  );
};
