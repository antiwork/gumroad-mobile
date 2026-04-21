import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { LineIcon } from "@/components/icon";
import { StyledImage } from "@/components/styled";
import { useAuth } from "@/lib/auth-context";
import { env } from "@/lib/env";
import { safeOpenURL } from "@/lib/open-url";
import { requestAPI } from "@/lib/request";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import * as Sentry from "@sentry/react-native";
import { useCSSVariable } from "uniwind";
import bundleThumbnail from "@/assets/images/native-types/bundle.svg";
import callThumbnail from "@/assets/images/native-types/call.svg";
import coffeeThumbnail from "@/assets/images/native-types/coffee.svg";
import courseThumbnail from "@/assets/images/native-types/course.svg";
import digitalThumbnail from "@/assets/images/native-types/digital.svg";
import ebookThumbnail from "@/assets/images/native-types/ebook.svg";
import membershipThumbnail from "@/assets/images/native-types/membership.svg";

type CreateProductResponse = {
  success: boolean;
  product: {
    id: string;
    unique_permalink?: string | null;
    custom_permalink?: string | null;
  };
};

type ProductKindId = "digital" | "course" | "ebook" | "membership" | "bundle" | "call" | "coffee";
type NativeProductKind = "digital" | "course" | "ebook" | "membership" | "bundle" | "call" | "coffee";
type SubscriptionDuration = "monthly";

const PRODUCT_KIND_OPTIONS: {
  id: ProductKindId;
  nativeType: NativeProductKind;
  subscriptionDuration?: SubscriptionDuration;
  thumbnail: React.ComponentProps<typeof StyledImage>["source"];
  title: string;
  description: string;
}[] = [
  { id: "digital", nativeType: "digital", thumbnail: digitalThumbnail, title: "Digital product", description: "Any set of files to download or stream." },
  { id: "course", nativeType: "course", thumbnail: courseThumbnail, title: "Course or tutorial", description: "Sell a lesson or a full learning experience." },
  { id: "ebook", nativeType: "ebook", thumbnail: ebookThumbnail, title: "E-book", description: "Offer books and comics in downloadable formats." },
  {
    id: "membership",
    nativeType: "membership",
    subscriptionDuration: "monthly",
    thumbnail: membershipThumbnail,
    title: "Membership",
    description: "Start a recurring membership around your audience.",
  },
  { id: "bundle", nativeType: "bundle", thumbnail: bundleThumbnail, title: "Bundle", description: "Sell multiple existing products as one offer." },
  { id: "call", nativeType: "call", thumbnail: callThumbnail, title: "Call", description: "Offer scheduled calls with your customers." },
  { id: "coffee", nativeType: "coffee", thumbnail: coffeeThumbnail, title: "Coffee", description: "Accept support and tips from your audience." },
];

export default function ProductNew() {
  const { isLoading: isAuthLoading, accessToken } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [selectedKind, setSelectedKind] = useState<ProductKindId>("digital");
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

    const selectedOption = PRODUCT_KIND_OPTIONS.find((option) => option.id === selectedKind);
    const nativeType = selectedOption?.nativeType ?? "digital";
    const subscriptionDuration = selectedOption?.subscriptionDuration;

    setError(null);
    setIsSubmitting(true);
    try {
      const response = await requestAPI<CreateProductResponse>("/v2/products", {
        accessToken,
        method: "POST",
        data: {
          name: trimmedName,
          price: Math.round(parsedPrice * 100),
          native_type: nativeType,
          ...(subscriptionDuration ? { subscription_duration: subscriptionDuration } : {}),
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
      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-8"
        keyboardShouldPersistTaps="handled"
      >
        <View className="border-b border-border px-4 py-4">
          <Text className="text-2xl font-bold">What are you creating?</Text>
          <Text className="mt-2 text-sm text-muted">
            Turn your idea into a live product in minutes. No fuss, just a few quick selections.
          </Text>
          <Pressable onPress={() => void safeOpenURL(`${env.EXPO_PUBLIC_GUMROAD_URL}/help`)} className="mt-3">
            <Text className="text-sm text-accent">Need help adding a product?</Text>
          </Pressable>
        </View>

        <View className="gap-4 px-4 py-4">
          {error ? (
            <View className="rounded-lg border border-destructive/50 bg-card px-3 py-3">
              <Text className="text-sm text-destructive">{error}</Text>
            </View>
          ) : null}

          <View className="gap-2">
            <Text className="text-xs uppercase tracking-wide text-muted">Products</Text>
            <Card className="rounded-lg">
              <CardContent className="gap-2 p-3">
                {PRODUCT_KIND_OPTIONS.map((option) => {
                  const isActive = selectedKind === option.id;
                  return (
                    <Pressable
                      key={option.id}
                      onPress={() => setSelectedKind(option.id)}
                      className={`rounded-lg border px-3 py-3 ${isActive ? "border-foreground bg-muted/20" : "border-border bg-background"}`}
                    >
                      <View className="flex-row items-start gap-3">
                        <View className="overflow-hidden rounded-md border border-border">
                          <StyledImage source={option.thumbnail} className="size-11" contentFit="cover" />
                        </View>
                        <View className="flex-1">
                          <Text className="font-medium text-foreground">{option.title}</Text>
                          <Text className="mt-1 text-xs text-muted">{option.description}</Text>
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </CardContent>
            </Card>
          </View>

          <View className="gap-2">
            <Text className="text-xs uppercase tracking-wide text-muted">Product details</Text>
            <Card className="rounded-lg">
              <CardContent className="gap-4 p-3">
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
          </View>

          <View className="gap-2 pt-1">
            <Button variant="accent" onPress={() => void createProduct()} disabled={isSubmitting}>
              <Text>{isSubmitting ? "Creating..." : "Next: Customize"}</Text>
              <LineIcon name="arrow-right-stroke" size={18} className="text-primary-foreground" />
            </Button>

            <Button variant="outline" onPress={() => router.back()} disabled={isSubmitting}>
              <Text>Cancel</Text>
            </Button>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}
