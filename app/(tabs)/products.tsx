import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import { requestAPI } from "@/lib/request";
import * as Sentry from "@sentry/react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Image, Pressable, RefreshControl, View } from "react-native";

interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  formatted_price: string;
  thumbnail_url?: string;
  published: boolean;
  tags?: string[];
  custom_summary?: string;
  deleted: boolean;
  sales_count?: number;
}

interface ProductsResponse {
  success: boolean;
  products: Product[];
  next_page_key?: string;
  next_page_url?: string;
}

const ProductCard = ({
  product,
  onPress,
}: {
  product: Product;
  onPress: () => void;
}) => (
  <Pressable onPress={onPress} className="flex-row items-center gap-3 border-b border-border bg-background pr-4 py-3">
    {product.thumbnail_url ? (
      <Image source={{ uri: product.thumbnail_url }} className="size-16 bg-muted" resizeMode="cover" />
    ) : (
      <View className="size-16 items-center justify-center bg-muted">
        <Text className="text-lg">📦</Text>
      </View>
    )}
    <View className="flex-1">
      <Text className="text-sm font-bold" numberOfLines={1}>
        {product.name}
      </Text>
      <Text className="text-xs text-muted">
        {product.published ? "Published" : "Draft"} • {product.sales_count ?? 0} sales
      </Text>
    </View>
    <View className="items-end">
      <Text className="text-sm font-bold">{product.formatted_price}</Text>
    </View>
  </Pressable>
);

export default function Products() {
  const { isLoading: isAuthLoading, accessToken } = useAuth();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async (isRefresh = false) => {
    if (!accessToken) {
      setError("Not authenticated");
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      const response = await requestAPI<ProductsResponse>("/v2/products", { accessToken });
      if (!response.success) throw new Error("Unable to load products");

      setProducts((response.products ?? []).filter((product) => !product.deleted));
    } catch (error) {
      Sentry.captureException(error);
      setError(error instanceof Error ? error.message : "Failed to load products");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [accessToken]);

  useFocusEffect(
    useCallback(() => {
      fetchProducts();
    }, [fetchProducts]),
  );

  const handleProductPress = (product: Product) => {
    router.push({
      pathname: "/products/[id]",
      params: { id: product.id },
    });
  };

  if (isAuthLoading) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <LoadingSpinner size="large" />
        </View>
      </Screen>
    );
  }

  if (error && products.length === 0) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center px-4">
          <Text className="text-center text-muted mb-4">{error}</Text>
          <Pressable onPress={() => fetchProducts()} className="rounded bg-primary px-4 py-2">
            <Text className="text-primary-foreground">Retry</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => fetchProducts(true)}
          />
        }
        renderItem={({ item }) => (
          <ProductCard
            product={item}
            onPress={() => handleProductPress(item)}
          />
        )}
        ListEmptyComponent={
          !isLoading ? (
            <View className="items-center justify-center py-20 px-4">
              <Text className="text-lg text-muted text-center mb-4">
                No products yet
              </Text>
              <Pressable onPress={() => router.push("/products/new")} className="rounded bg-primary px-4 py-2">
                <Text className="text-primary-foreground">Create your first product</Text>
              </Pressable>
            </View>
          ) : null
        }
        ListFooterComponent={
          isLoading && products.length > 0 ? (
            <View className="w-full items-center py-4">
              <LoadingSpinner size="small" />
            </View>
          ) : null
        }
      />
    </Screen>
  );
}
