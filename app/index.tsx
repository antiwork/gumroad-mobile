import { Link, Redirect } from "expo-router";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { styled } from "react-native-css";
import { useAuth } from "../lib/auth-context";

const StyledLink = styled(Link, { className: "style" });

export default function Index() {
  const { isAuthenticated, isLoading, logout, accessToken } = useAuth();

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#0d0d0d]">
        <ActivityIndicator size="large" color="#ff90e8" />
      </View>
    );
  }

  if (!isAuthenticated) return <Redirect href="/login" />;

  return (
    <View className="flex-1 items-center justify-center bg-[#0d0d0d] px-6">
      <View className="absolute top-0 right-0 left-0 h-1 bg-[#23c55e]" />

      <View className="mb-8 items-center">
        <Text className="mb-2 text-3xl font-bold text-white">Welcome to Gumroad</Text>
        <Text className="text-center text-[#a3a3a3]">You&lsquo;re successfully authenticated</Text>
      </View>

      <View className="mb-6 w-full max-w-sm rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-4">
        <Text className="mb-2 text-xs text-[#666]">Access Token:</Text>
        <Text className="font-mono text-xs text-[#ff90e8]" numberOfLines={3}>
          {accessToken?.substring(0, 50)}...
        </Text>
      </View>

      <View className="w-full max-w-sm gap-3">
        <StyledLink href="/about" className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] px-6 py-4 text-center">
          <Text className="font-medium text-white">Go to About</Text>
        </StyledLink>

        <Pressable onPress={logout} className="items-center rounded-xl bg-[#2a2a2a] px-6 py-4 active:bg-[#3a3a3a]">
          <Text className="font-medium text-[#ff6b6b]">Sign Out</Text>
        </Pressable>
      </View>
    </View>
  );
}
