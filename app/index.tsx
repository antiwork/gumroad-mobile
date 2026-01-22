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
    <View className="flex-1 bg-body-bg">
      {isLoadingPurchases ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#ff90e8" />
        </View>
      ) : (
        <FlatList<Purchase>
          data={purchases}
          keyExtractor={(item) => item.url_redirect_token}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => router.push(`/purchase/${item.url_redirect_token}`)}
              className="flex-row items-center gap-4 rounded-xl border border-border bg-background p-3"
            >
              {item.thumbnail_url ? (
                <Image
                  source={{ uri: item.thumbnail_url }}
                  className="h-16 w-16 rounded-lg bg-background"
                  resizeMode="cover"
                />
              ) : (
                <View className="h-16 w-16 items-center justify-center rounded-lg bg-background">
                  <Text className="text-2xl">📦</Text>
                </View>
              )}
              <View className="flex-1">
                <Text className="text-base font-medium text-foreground" numberOfLines={2}>
                  {item.name}
                </Text>
              </View>
              <Text className="text-muted">›</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View className="items-center justify-center py-20">
              <Text className="text-lg text-muted">No purchases yet</Text>
            </View>
          }
        />
      )}
    </View>
  );
}
