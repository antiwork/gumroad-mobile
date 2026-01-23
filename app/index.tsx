import { Screen } from "@/components/ui/screen";
import { assertDefined } from "@/lib/assert";
import { useAuth } from "@/lib/auth-context";
import { requestAPI, UnauthorizedError } from "@/lib/request";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, FlatList, Image, Text, TouchableOpacity, View } from "react-native";

export interface Purchase {
  name: string;
  creator_name: string;
  creator_profile_picture_url: string;
  thumbnail_url: string | null;
  url_redirect_token: string;
  purchase_email: string;
  purchase_id?: string;
  file_data?: {
    id: string;
    filegroup?: string;
    streaming_url?: string;
  }[];
}

interface PurchasesResponse {
  success: boolean;
  products: Purchase[];
  user_id: string;
}

export const usePurchases = () => {
  const { isLoading, accessToken, logout } = useAuth();

  const query = useQuery({
    queryKey: ["purchases"],
    queryFn: async () => {
      const response = await requestAPI<PurchasesResponse>("mobile/purchases/index", {
        accessToken: assertDefined(accessToken),
      });
      return response.products;
    },
    enabled: !!accessToken,
  });

  useEffect(() => {
    if ((!isLoading && !accessToken) || query.error instanceof UnauthorizedError) logout();
  }, [isLoading, accessToken, query.error, logout]);

  return query;
};

export default function Index() {
  const { isLoading } = useAuth();
  const { data: purchases = [], isLoading: isLoadingPurchases, error } = usePurchases();
  const router = useRouter();

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-[#0d0d0d]">
        <Text className="text-white">Error: {error.message}</Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#0d0d0d]">
        <ActivityIndicator size="large" color="#ff90e8" />
      </View>
    );
  }

  return (
    <Screen>
      {isLoadingPurchases ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#ff90e8" />
        </View>
      ) : (
        <FlatList<Purchase>
          numColumns={2}
          data={purchases}
          keyExtractor={(item) => item.url_redirect_token}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          columnWrapperStyle={{ gap: 12 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => router.push(`/purchase/${item.url_redirect_token}`)}
              className="max-w-1/2 flex-1 overflow-hidden rounded border border-border bg-background"
            >
              {item.thumbnail_url ? (
                <Image
                  source={{ uri: item.thumbnail_url }}
                  className="aspect-square bg-background"
                  resizeMode="cover"
                />
              ) : (
                <View className="aspect-square items-center justify-center bg-background">
                  <Text className="text-2xl">📦</Text>
                </View>
              )}
              <View className="border-y border-border p-2">
                <Text className="font-sans text-base text-foreground" numberOfLines={2}>
                  {item.name}
                </Text>
              </View>
              <View className="flex-row items-center gap-2 p-2">
                <Image source={{ uri: item.creator_profile_picture_url }} className="size-4 rounded-full" />
                <Text className="font-sans text-sm text-foreground">{item.creator_name}</Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View className="items-center justify-center py-20">
              <Text className="font-sans text-lg text-muted">No purchases yet</Text>
            </View>
          }
        />
      )}
    </Screen>
  );
}
