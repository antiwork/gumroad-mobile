import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import { requestAPI } from "@/lib/request";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, TextInput, View } from "react-native";
import * as Sentry from "@sentry/react-native";

type ProductDetailsResponse = {
  success: boolean;
  product: {
    id: string;
    name: string;
    description?: string;
    custom_summary?: string;
    price: number;
    formatted_price: string;
    published: boolean;
    unique_permalink?: string | null;
  };
};

export default function ProductEdit() {
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const productId = Array.isArray(id) ? id[0] : id;
  const { isLoading: isAuthLoading, accessToken } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [customSummary, setCustomSummary] = useState("");
  const [published, setPublished] = useState(false);
  const [formattedPrice, setFormattedPrice] = useState<string | null>(null);

  const fetchProduct = useCallback(async () => {
    if (!productId) {
      setError("Missing product identifier.");
      setIsLoading(false);
      return;
    }
    if (!accessToken) {
      setError("You must be signed in to edit products.");
      setIsLoading(false);
      return;
    }

    setError(null);
    setIsLoading(true);
    try {
      const response = await requestAPI<ProductDetailsResponse>(`/v2/products/${encodeURIComponent(productId)}`, {
        accessToken,
      });
      setName(response.product.name ?? "");
      setDescription(response.product.description ?? "");
      setCustomSummary(response.product.custom_summary ?? "");
      setPrice((response.product.price / 100).toFixed(2));
      setPublished(!!response.product.published);
      setFormattedPrice(response.product.formatted_price ?? null);
    } catch (requestError) {
      Sentry.captureException(requestError);
      setError(requestError instanceof Error ? requestError.message : "Could not load product.");
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, productId]);

  useEffect(() => {
    void fetchProduct();
  }, [fetchProduct]);

  const handleSavePress = useCallback(async () => {
    if (!productId || !accessToken) return;
    const trimmedName = name.trim();
    const normalizedPrice = price.trim();
    if (!trimmedName) {
      setError("Product name is required.");
      return;
    }
    const parsedPrice = Number(normalizedPrice);
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      setError("Price must be a valid number.");
      return;
    }

    setError(null);
    setSaveNotice(null);
    setIsSaving(true);
    try {
      await requestAPI(`/v2/products/${encodeURIComponent(productId)}`, {
        accessToken,
        method: "PUT",
        data: {
          name: trimmedName,
          price: Math.round(parsedPrice * 100),
          description: description.trim(),
          custom_summary: customSummary.trim() || null,
        },
      });
      setSaveNotice("Changes saved.");
      await fetchProduct();
    } catch (requestError) {
      Sentry.captureException(requestError);
      setError(requestError instanceof Error ? requestError.message : "Could not save product.");
    } finally {
      setIsSaving(false);
    }
  }, [accessToken, customSummary, description, fetchProduct, name, price, productId]);

  const handleTogglePublishPress = useCallback(async () => {
    if (!productId || !accessToken || isSaving || isLoading) return;
    setError(null);
    setSaveNotice(null);
    setIsSaving(true);
    try {
      await requestAPI(`/v2/products/${encodeURIComponent(productId)}/${published ? "disable" : "enable"}`, {
        accessToken,
        method: "PUT",
      });
      setSaveNotice(published ? "Product moved to draft." : "Product published.");
      await fetchProduct();
    } catch (requestError) {
      Sentry.captureException(requestError);
      setError(requestError instanceof Error ? requestError.message : "Could not change publish status.");
    } finally {
      setIsSaving(false);
    }
  }, [accessToken, fetchProduct, isLoading, isSaving, productId, published]);

  const handleDeletePress = useCallback(() => {
    if (!productId || !accessToken || isSaving || isLoading) return;
    Alert.alert("Delete product?", "This action cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void (async () => {
            setError(null);
            setSaveNotice(null);
            setIsSaving(true);
            try {
              await requestAPI(`/v2/products/${encodeURIComponent(productId)}`, {
                accessToken,
                method: "DELETE",
              });
              router.replace("/(tabs)/products");
            } catch (requestError) {
              Sentry.captureException(requestError);
              setError(requestError instanceof Error ? requestError.message : "Could not delete product.");
            } finally {
              setIsSaving(false);
            }
          })();
        },
      },
    ]);
  }, [accessToken, isLoading, isSaving, productId, router]);

  if (!productId) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center px-4">
          <Text className="text-center text-muted">Unable to load product editor.</Text>
        </View>
      </Screen>
    );
  }

  if (isAuthLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-body-bg">
        <LoadingSpinner size="large" />
      </View>
    );
  }

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: "Edit product",
          headerRight: () => (
            <View>
              <Button size="sm" onPress={() => void handleSavePress()} disabled={isSaving || isLoading}>
                <Text>Save</Text>
              </Button>
            </View>
          ),
        }}
      />
      <View className="flex-1 gap-4 px-4 py-6">
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <LoadingSpinner size="large" />
          </View>
        ) : null}

        {!isLoading ? (
          <>
            {error ? (
              <View className="rounded border border-border bg-background px-3 py-3">
                <Text className="text-sm text-muted">{error}</Text>
              </View>
            ) : null}
            {saveNotice ? (
              <View className="rounded border border-border bg-background px-3 py-3">
                <Text className="text-sm text-muted">{saveNotice}</Text>
              </View>
            ) : null}

            <View className="gap-2">
              <Text className="text-sm">Name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Product name"
                autoCapitalize="sentences"
                className="rounded-lg border border-border bg-background px-3 py-3 text-foreground"
              />
            </View>

            <View className="gap-2">
              <Text className="text-sm">Summary</Text>
              <TextInput
                value={customSummary}
                onChangeText={setCustomSummary}
                placeholder="Short product summary"
                autoCapitalize="sentences"
                className="rounded-lg border border-border bg-background px-3 py-3 text-foreground"
              />
            </View>

            <View className="gap-2">
              <Text className="text-sm">Description</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Describe your product"
                multiline
                textAlignVertical="top"
                autoCapitalize="sentences"
                className="min-h-28 rounded-lg border border-border bg-background px-3 py-3 text-foreground"
              />
            </View>

            <View className="gap-2">
              <Text className="text-sm">Price</Text>
              <TextInput
                value={price}
                onChangeText={(value) => {
                  const normalized = value.replace(/,/g, ".").replace(/[^0-9.]/g, "");
                  setPrice(normalized);
                }}
                placeholder="0.00"
                keyboardType="decimal-pad"
                className="rounded-lg border border-border bg-background px-3 py-3 text-foreground"
              />
              {formattedPrice ? <Text className="text-xs text-muted">Current: {formattedPrice}</Text> : null}
            </View>

            <View className="rounded border border-border bg-background px-3 py-3">
              <Text className="text-sm text-muted">Status: {published ? "Published" : "Draft"}</Text>
            </View>

            <View className="flex-row gap-2">
              <Button onPress={() => void handleSavePress()} disabled={isSaving}>
                <Text>{isSaving ? "Saving..." : "Save changes"}</Text>
              </Button>
              <Button variant="outline" onPress={() => void handleTogglePublishPress()} disabled={isSaving}>
                <Text>{published ? "Unpublish" : "Publish"}</Text>
              </Button>
            </View>
            <View className="flex-row gap-2">
              <Button variant="outline" onPress={() => void fetchProduct()} disabled={isSaving}>
                <Text>Reload</Text>
              </Button>
              <Button variant="ghost" onPress={handleDeletePress} disabled={isSaving}>
                <Text className="text-destructive">Delete</Text>
              </Button>
            </View>
            <Button variant="outline" onPress={() => router.back()} disabled={isSaving}>
              <Text>Back</Text>
            </Button>
          </>
        ) : null}
      </View>
    </Screen>
  );
}
