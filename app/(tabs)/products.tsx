import { LineIcon } from "@/components/icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useProductsSearch } from "@/app/(tabs)/_layout";
import { useAuth } from "@/lib/auth-context";
import { requestAPI } from "@/lib/request";
import * as Sentry from "@sentry/react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Image, Pressable, RefreshControl, TextInput, View } from "react-native";
import { useCSSVariable } from "uniwind";

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
      className="mx-4 mb-3"
    >
      <Card className="rounded-xl">
        <CardContent className="p-3">
          <View className="flex-row gap-3">
            {product.thumbnail_url ? (
              <Image source={{ uri: product.thumbnail_url }} className="size-16 rounded-lg bg-muted" resizeMode="cover" />
            ) : (
              <View className="size-16 items-center justify-center rounded-lg bg-muted">
                <LineIcon name="package" size={20} className="text-muted" />
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
                    <Badge variant="outline">
                      <Text>PWYW</Text>
                    </Badge>
                  ) : null}
                  <Text className="text-sm font-bold">{product.formatted_price}</Text>
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

export default function Products() {
  const { isLoading: isAuthLoading, accessToken } = useAuth();
  const { isProductSearchActive, setProductSearchActive } = useProductsSearch();
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft">("all");
  const mutedColor = useCSSVariable("--color-muted") as string;
  const totalSalesCount = products.reduce((sum, product) => sum + (product.sales_count ?? 0), 0);
  const revenueCurrency = (products[0]?.currency || "USD").toUpperCase();
  const totalSalesRevenueCents = products.reduce((sum, product) => sum + (product.price || 0) * (product.sales_count ?? 0), 0);
  const formattedSalesRevenue = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: revenueCurrency,
    maximumFractionDigits: 2,
  }).format(totalSalesRevenueCents / 100);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery.trim().toLowerCase()), 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (isProductSearchActive) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setSearchQuery("");
    }
  }, [isProductSearchActive]);

  const filteredProducts = useMemo(
    () =>
      products.filter((product) => {
      if (statusFilter === "published" && !product.published) return false;
      if (statusFilter === "draft" && product.published) return false;
      if (!debouncedSearchQuery) return true;
      const searchText = `${product.name} ${product.custom_summary ?? ""} ${product.description ?? ""}`.toLowerCase();
      return searchText.includes(debouncedSearchQuery);
      }),
    [debouncedSearchQuery, products, statusFilter],
  );

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
    const editIdentifier = product.id?.trim() || null;
    console.info("[Products] Open editor attempt", {
      productId: product.id,
      shortUrl: product.short_url,
      url: product.url,
      resolvedEditIdentifier: editIdentifier,
    });
    if (!editIdentifier) {
      setError("Unable to open this product right now.");
      Sentry.captureMessage("Missing product edit identifier", {
        level: "warning",
        extra: {
          productId: product.id,
          shortUrl: product.short_url,
          url: product.url,
        },
      });
      return;
    }
    router.push({
      pathname: "/products/[id]",
      params: {
        id: editIdentifier,
        shortUrl: product.short_url ?? "",
      },
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
      {isProductSearchActive ? (
        <View className="flex-row items-center border-b border-border/70 px-4 py-3">
          <View className="flex-1 flex-row items-center rounded-lg border border-border bg-card px-3 py-2">
            <LineIcon name="search" size={18} className="text-muted" />
            <TextInput
              ref={inputRef}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search products"
              placeholderTextColor={mutedColor}
              autoCapitalize="none"
              autoCorrect={false}
              className="ml-2 flex-1 text-foreground"
            />
            {searchQuery.length > 0 ? (
              <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
                <LineIcon name="x" size={18} className="text-muted" />
              </Pressable>
            ) : (
              <Pressable onPress={() => setProductSearchActive(false)} hitSlop={8}>
                <LineIcon name="x" size={18} className="text-muted" />
              </Pressable>
            )}
          </View>
        </View>
      ) : null}
      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 16 }}
        ListHeaderComponent={
          <View className="gap-3 border-b border-border/70 px-4 py-4">
            {error ? <Text className="text-xs text-muted">{error}</Text> : null}
            <View className="flex-row gap-2">
              {[
                { id: "all", label: "All" },
                { id: "published", label: "Published" },
                { id: "draft", label: "Drafts" },
              ].map((filter) => {
                const isActive = statusFilter === filter.id;
                return (
                  <Button
                    key={filter.id}
                    onPress={() => setStatusFilter(filter.id as "all" | "published" | "draft")}
                    variant={isActive ? "outline" : "ghost"}
                    size="sm"
                    className="rounded-full"
                  >
                    <Text className={isActive ? "text-foreground" : "text-muted"}>{filter.label}</Text>
                  </Button>
                );
              })}
            </View>
            <View className="flex-row gap-2">
              <View className="flex-1 rounded-xl border border-border bg-card px-3 py-2">
                <Text className="text-xs text-muted">Sales Revenue</Text>
                <Text className="text-lg font-bold">{formattedSalesRevenue}</Text>
              </View>
              <View className="flex-1 rounded-xl border border-border bg-card px-3 py-2">
                <Text className="text-xs text-muted">Sales</Text>
                <Text className="text-lg font-bold">{totalSalesCount.toLocaleString()}</Text>
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
              <Text className="text-lg text-muted text-center mb-2">
                {products.length > 0 ? "No products match your filters" : "No products yet"}
              </Text>
              {products.length > 0 ? (
                <Text className="mb-4 text-sm text-muted text-center">Try changing your search or status filter.</Text>
              ) : (
                <>
                  <Text className="mb-4 text-sm text-muted text-center">Create your first product to start selling from mobile.</Text>
                  <Pressable onPress={() => router.push("/products/new")} className="rounded bg-primary px-4 py-2">
                    <Text className="text-primary-foreground">Create your first product</Text>
                  </Pressable>
                </>
              )}
            </View>
          ) : null
        }
        ListFooterComponent={
          isLoading && filteredProducts.length > 0 ? (
            <View className="w-full items-center py-4">
              <LoadingSpinner size="small" />
            </View>
          ) : null
        }
      />
    </Screen>
  );
}
