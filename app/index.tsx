import { requestAPI } from "@/lib/request";
import { Redirect, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, Text, View } from "react-native";
import { useAuth } from "../lib/auth-context";

interface Purchase {
  name: string;
  thumbnail_url: string | null;
  url_redirect_token: string;
  purchase_email: string;
}

interface PurchasesResponse {
  success: boolean;
  products: Purchase[];
  user_id: string;
}

export default function Index() {
  const { isAuthenticated, isLoading, logout, accessToken } = useAuth();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [isLoadingPurchases, setIsLoadingPurchases] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated && accessToken) {
      const fetchPurchases = async () => {
        if (!accessToken) return;

        setIsLoadingPurchases(true);
        try {
          const response = await requestAPI<PurchasesResponse>("mobile/purchases/index", {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          });
          setPurchases(response.products);
        } catch (error) {
          console.error("Failed to fetch purchases:", error);
        } finally {
          setIsLoadingPurchases(false);
        }
      };
      fetchPurchases();
    }
  }, [isAuthenticated, accessToken]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#0d0d0d]">
        <ActivityIndicator size="large" color="#ff90e8" />
      </View>
    );
  }

  if (!isAuthenticated) return <Redirect href="/login" />;

  return (
    <View className="flex-1 bg-[#0d0d0d]">
      <View className="absolute top-0 right-0 left-0 z-10 h-1 bg-[#23c55e]" />

      <View className="border-b border-[#2a2a2a] px-6 pt-14 pb-4">
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-white">Library</Text>
          <Pressable onPress={logout} className="rounded-lg bg-[#2a2a2a] px-4 py-2 active:bg-[#3a3a3a]">
            <Text className="text-sm font-medium text-[#ff6b6b]">Sign Out</Text>
          </Pressable>
        </View>
      </View>

      {isLoadingPurchases ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#ff90e8" />
        </View>
      ) : (
        <FlatList
          data={purchases}
          keyExtractor={(item) => item.url_redirect_token}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/purchase/${item.url_redirect_token}`)}
              className="flex-row items-center gap-4 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-3 active:bg-[#252525]"
            >
              {item.thumbnail_url ? (
                <Image
                  source={{ uri: item.thumbnail_url }}
                  className="h-16 w-16 rounded-lg bg-[#2a2a2a]"
                  resizeMode="cover"
                />
              ) : (
                <View className="h-16 w-16 items-center justify-center rounded-lg bg-[#2a2a2a]">
                  <Text className="text-2xl">📦</Text>
                </View>
              )}
              <View className="flex-1">
                <Text className="text-base font-medium text-white" numberOfLines={2}>
                  {item.name}
                </Text>
              </View>
              <Text className="text-[#666]">›</Text>
            </Pressable>
          )}
          ListEmptyComponent={
            <View className="items-center justify-center py-20">
              <Text className="text-lg text-[#666]">No purchases yet</Text>
            </View>
          }
        />
      )}
    </View>
  );
}
