import { LineIcon } from "@/components/icon";
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
  url?: string | null;
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
  short_url?: string;
  customizable_price?: boolean;
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
  isFirst,
}: {
  product: Product;
  onPress: () => void;
  isFirst: boolean;
}) => {
  const subtitle = product.custom_summary || product.description;

  return (
    <Pressable
      onPress={onPress}
      style={isFirst ? { marginTop: 12 } : undefined}
      className="mx-4 mb-3 rounded-xl border border-border bg-background p-3"
    >
      <View className="flex-row gap-3">
        {product.thumbnail_url ? (
          <Image source={{ uri: product.thumbnail_url }} className="size-16 rounded bg-muted" resizeMode="cover" />
        ) : (
          <View className="size-16 items-center justify-center rounded bg-muted">
            <LineIcon name="package" size={20} className="text-muted" />
          </View>
        )}
        <View className="flex-1 gap-1">
          <View className="flex-row items-start justify-between gap-2">
            <Text className="flex-1 text-base font-bold" numberOfLines={1}>
              {product.name}
            </Text>
            <View className="rounded-full bg-muted px-2 py-1">
              <Text className="text-xs font-medium text-foreground">{product.published ? "Published" : "Draft"}</Text>
            </View>
          </View>
          {product.short_url ? (
            <Text className="text-xs text-muted" numberOfLines={1}>
              {product.short_url}
            </Text>
          ) : null}
          {subtitle ? (
            <Text className="text-xs text-muted" numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
          <View className="mt-1 flex-row items-center justify-between">
            <Text className="text-xs text-muted">{product.sales_count ?? 0} sales</Text>
            <View className="flex-row items-center gap-2">
              {product.customizable_price ? (
                <View className="rounded-full border border-border px-2 py-0.5">
                  <Text className="text-[10px] text-muted">PWYW</Text>
                </View>
              ) : null}
              <Text className="text-sm font-bold">{product.formatted_price}</Text>
              <LineIcon name="chevron-right" size={16} className="text-muted" />
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
};

export default function Products() {
  const { isLoading: isAuthLoading, accessToken } = useAuth();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const publishedCount = products.filter((product) => product.published).length;
  const draftCount = products.length - publishedCount;

  const getProductEditIdentifier = (product: Product) => {
    const fromShortUrl = product.short_url?.match(/\/l\/([^/?#]+)/)?.[1];
    const fromUrl = product.url?.match(/\/l\/([^/?#]+)/)?.[1];
    return fromShortUrl || fromUrl || null;
  };

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
    const editIdentifier = getProductEditIdentifier(product);
    if (!editIdentifier) {
      setError("Unable to open this product right now.");
      Sentry.captureMessage("Missing product edit identifier", {
        level: "warning",
        extra: { productId: product.id, shortUrl: product.short_url, url: product.url },
      });
      return;
    }

    router.push(`/products/${encodeURIComponent(editIdentifier)}`);
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
        ListHeaderComponent={
          <View className="gap-3 border-b border-border px-4 py-4">
            <Text className="text-xl font-bold">Products</Text>
            {error ? <Text className="text-xs text-muted">{error}</Text> : null}
            <View className="flex-row gap-2">
              <View className="flex-1 rounded-lg border border-border bg-background px-3 py-2">
                <Text className="text-xs text-muted">Total</Text>
                <Text className="text-lg font-bold">{products.length}</Text>
              </View>
              <View className="flex-1 rounded-lg border border-border bg-background px-3 py-2">
                <Text className="text-xs text-muted">Published</Text>
                <Text className="text-lg font-bold">{publishedCount}</Text>
              </View>
              <View className="flex-1 rounded-lg border border-border bg-background px-3 py-2">
                <Text className="text-xs text-muted">Drafts</Text>
                <Text className="text-lg font-bold">{draftCount}</Text>
              </View>
            </View>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => fetchProducts(true)}
          />
        }
        renderItem={({ item, index }) => (
          <ProductCard
            product={item}
            isFirst={index === 0}
            onPress={() => handleProductPress(item)}
          />
        )}
        ListEmptyComponent={
          !isLoading ? (
            <View className="items-center justify-center py-20 px-4">
              <View className="mb-4 rounded-full border border-border p-3">
                <LineIcon name="package" size={24} className="text-muted" />
              </View>
              <Text className="text-lg text-muted text-center mb-2">No products yet</Text>
              <Text className="mb-4 text-sm text-muted text-center">Create your first product to start selling from mobile.</Text>
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
