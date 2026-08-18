import { GettingStartedPlaceholder } from "@/components/getting-started-placeholder";
import { ProductItem } from "@/components/products/product-item";
import { SellerProduct, useDeleteProduct, useProducts } from "@/components/products/use-products";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback } from "react";
import { Alert, FlatList, RefreshControl, View } from "react-native";
import { useCSSVariable } from "uniwind";

export default function Products() {
  const { isLoading: isAuthLoading } = useAuth();
  const { products, isLoading, error, refetch, isRefetching, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useProducts();
  const deleteProduct = useDeleteProduct();
  const router = useRouter();
  const accentColor = useCSSVariable("--color-accent") as string;

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  const openCreate = () => router.push("/create-product");

  const openEdit = (product: SellerProduct) => {
    if (!product.can_edit) return;
    router.push({ pathname: "/edit-product", params: { permalink: product.permalink, name: product.name } });
  };

  const confirmDelete = (product: SellerProduct) => {
    if (!product.can_destroy) return;
    Alert.alert("Delete product?", `"${product.name}" will be deleted. This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          deleteProduct.mutate(product.id, {
            onError: () => Alert.alert("Couldn't delete product", "Please try again."),
          });
        },
      },
    ]);
  };

  if (isAuthLoading || (isLoading && products.length === 0)) {
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
        <View className="flex-1 items-center justify-center gap-4 p-8">
          <Text className="text-center font-sans text-foreground">Couldn't load your products.</Text>
          <Button onPress={() => void refetch()}>
            <Text>Retry</Text>
          </Button>
        </View>
      </Screen>
    );
  }

  if (products.length === 0) {
    return (
      <Screen>
        <GettingStartedPlaceholder message="Create your first product and it will show up here." />
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ProductItem product={item} onPress={() => openEdit(item)} onLongPress={() => confirmDelete(item)} />
        )}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
        }}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching && !isFetchingNextPage}
            onRefresh={() => void refetch()}
            tintColor={accentColor}
          />
        }
        contentContainerStyle={{ flexGrow: 1 }}
        ListFooterComponent={
          isFetchingNextPage ? (
            <View className="items-center py-4">
              <LoadingSpinner />
            </View>
          ) : null
        }
      />
    </Screen>
  );
}
