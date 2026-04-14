import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { LineIcon } from "@/components/icon";
import { useAuth } from "@/lib/auth-context";
import { requestAPI } from "@/lib/request";
import { useRouter } from "expo-router";
import { useState } from "react";
import { TextInput, View } from "react-native";
import * as Sentry from "@sentry/react-native";
import { useCSSVariable } from "uniwind";

type CreateProductResponse = {
  success: boolean;
  product: {
    id: string;
    unique_permalink?: string | null;
    custom_permalink?: string | null;
  };
};

export default function ProductNew() {
  const { isLoading: isAuthLoading, accessToken } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mutedColor = useCSSVariable("--color-muted") as string;

  const createProduct = async () => {
    if (!accessToken) {
      setError("You must be signed in to create a product.");
      return;
    }

    const trimmedName = name.trim();
    const normalizedPrice = price.trim();
    if (!trimmedName) {
      setError("Product name is required.");
      return;
    }
    if (!normalizedPrice) {
      setError("Price is required.");
      return;
    }

    const parsedPrice = Number(normalizedPrice);
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      setError("Price must be a valid number.");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      const response = await requestAPI<CreateProductResponse>("/v2/products", {
        accessToken,
        method: "POST",
        data: {
          name: trimmedName,
          price: Math.round(parsedPrice * 100),
          native_type: "digital",
        },
      });

      const editIdentifier = response.product.id?.trim();
      if (!editIdentifier) {
        setError("Product created, but we could not open the editor yet.");
        return;
      }

      router.replace({
        pathname: "/products/[id]",
        params: {
          id: editIdentifier,
        },
      });
    } catch (requestError) {
      Sentry.captureException(requestError);
      setError(requestError instanceof Error ? requestError.message : "Failed to create product.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isAuthLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-body-bg">
        <LoadingSpinner size="large" />
      </View>
    );
  }

  return (
    <Screen>
      <View className="flex-1 gap-4 px-4 py-6">
        <View className="flex-row items-center gap-2">
          <View className="rounded-lg bg-accent/20 p-2">
            <LineIcon name="package" size={18} className="text-accent" />
          </View>
          <View>
            <Text className="text-xl font-bold">Create product</Text>
            <Text className="text-xs text-muted">Start with basics, then continue editing.</Text>
          </View>
        </View>

        {error ? (
          <View className="rounded-lg border border-destructive/50 bg-card px-3 py-3">
            <Text className="text-sm text-muted">{error}</Text>
          </View>
        ) : null}

        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle>Product details</CardTitle>
          </CardHeader>
          <CardContent className="gap-4">
            <View className="gap-2">
              <Text className="text-sm">Name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Name of product"
                placeholderTextColor={mutedColor}
                autoCapitalize="sentences"
                className="rounded-lg border border-border bg-background px-3 py-3 text-foreground"
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
                placeholderTextColor={mutedColor}
                keyboardType="decimal-pad"
                className="rounded-lg border border-border bg-background px-3 py-3 text-foreground"
              />
            </View>
          </CardContent>
        </Card>

        <View className="gap-2">
          <Button onPress={() => void createProduct()} disabled={isSubmitting}>
            <Text>{isSubmitting ? "Creating..." : "Next: Customize"}</Text>
            <LineIcon name="arrow-right-stroke" size={18} className="text-primary-foreground" />
          </Button>

          <Button variant="outline" onPress={() => router.back()} disabled={isSubmitting}>
            <Text>Cancel</Text>
          </Button>
        </View>
      </View>
    </Screen>
  );
}
