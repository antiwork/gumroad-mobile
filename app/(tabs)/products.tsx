import { LineIcon } from "@/components/icon";
import { ProductCard } from "@/components/products/product-card";
import { StatCard } from "@/components/products/stat-card";
import { StatusFilter, StatusFilterBar } from "@/components/products/status-filter-bar";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useProductsSearch } from "@/app/(tabs)/_layout";
import { useAuth } from "@/lib/auth-context";
import { normalizeProducts, ProductModel, RawProduct } from "@/lib/product-api";
import { requestAPI } from "@/lib/request";
import * as Sentry from "@sentry/react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, RefreshControl, TextInput, View } from "react-native";
import { useCSSVariable } from "uniwind";

interface ProductsResponse {
  success: boolean;
  products: RawProduct[];
  next_page_key?: string;
  next_page_url?: string;
}

const formatUsdRevenue = (amountCents: number) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(amountCents / 100);

export default function Products() {
  const { isLoading: isAuthLoading, accessToken } = useAuth();
  const { isProductSearchActive, setProductSearchActive } = useProductsSearch();
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);
  const [products, setProducts] = useState<ProductModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [nextPageKey, setNextPageKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const mutedColor = useCSSVariable("--color-muted") as string;
  const totalSalesCount = products.reduce((sum, product) => sum + product.salesCount, 0);
  const totalSalesUsdCents = products.reduce((sum, product) => sum + product.salesUsdCents, 0);
  const formattedSalesRevenue = formatUsdRevenue(totalSalesUsdCents);

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
        const searchText = `${product.name} ${product.customSummary} ${product.description}`.toLowerCase();
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

      setProducts(normalizeProducts(response.products));
      setNextPageKey(response.next_page_key ?? null);
    } catch (err) {
      Sentry.captureException(err);
      setError(err instanceof Error ? err.message : "Failed to load products");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [accessToken]);

  const fetchMoreProducts = useCallback(async () => {
    if (!nextPageKey || !accessToken || isLoadingMore || isLoading) return;

    setIsLoadingMore(true);
    try {
      const response = await requestAPI<ProductsResponse>(
        `/v2/products?page_key=${encodeURIComponent(nextPageKey)}`,
        { accessToken },
      );
      if (!response.success) throw new Error("Unable to load more products");

      setProducts((prev) => [...prev, ...normalizeProducts(response.products)]);
      setNextPageKey(response.next_page_key ?? null);
    } catch (err) {
      Sentry.captureException(err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [accessToken, isLoading, isLoadingMore, nextPageKey]);

  useFocusEffect(
    useCallback(() => {
      void fetchProducts();
    }, [fetchProducts]),
  );

  const handleProductPress = (product: ProductModel) => {
    const editIdentifier = product.id?.trim() || null;
    if (!editIdentifier) {
      setError("Unable to open this product right now.");
      Sentry.captureMessage("Missing product edit identifier", {
        level: "warning",
        extra: {
          productId: product.id,
          shortUrl: product.shortUrl,
        },
      });
      return;
    }
    router.push({
      pathname: "/products/[id]",
      params: {
        id: editIdentifier,
        shortUrl: product.shortUrl ?? "",
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
          <Pressable onPress={() => void fetchProducts()} className="rounded bg-primary px-4 py-2">
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
              testID="product-search-input"
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
        onEndReached={() => {
          if (nextPageKey && !isLoadingMore && !isLoading) void fetchMoreProducts();
        }}
        onEndReachedThreshold={0.5}
        testID="products-list"
        ListHeaderComponent={
          <View className="gap-3 border-b border-border/70 px-4 py-4">
            {error ? <Text className="text-xs text-destructive">{error}</Text> : null}
            <StatusFilterBar value={statusFilter} onChange={setStatusFilter} />
            <View className="flex-row gap-2">
              <StatCard label="Revenue" value={formattedSalesRevenue} testID="revenue-stat" />
              <StatCard label="Sales" value={totalSalesCount.toLocaleString()} testID="sales-stat" />
            </View>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void fetchProducts(true)}
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
            <View className="items-center justify-center py-20 px-4" testID="empty-state">
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
          isLoading || isLoadingMore ? (
            <View className="w-full items-center py-4">
              <LoadingSpinner size="small" />
            </View>
          ) : null
        }
      />
    </Screen>
  );
}
