import { Redirect } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useAuth } from "../lib/auth-context";

export default function LoginScreen() {
  const { isAuthenticated, isLoading, login } = useAuth();

  useEffect(() => {
    // Speeds up opening the browser for the auth flow on Android
    WebBrowser.warmUpAsync();

    return () => {
      WebBrowser.coolDownAsync();
    };
  }, []);

  if (isAuthenticated) return <Redirect href="/" />;

  return (
    <View className="flex-1 items-center justify-center bg-[#0d0d0d] px-6">
      <View className="absolute top-0 right-0 left-0 h-1 bg-[#ff90e8]" />

      <View className="mb-12 items-center">
        <Text className="mb-2 text-5xl font-bold tracking-tight text-white">Gumroad</Text>
        <Text className="text-lg text-[#a3a3a3]">Mobile</Text>
      </View>

      <View className="w-full max-w-sm rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a] p-8">
        <Text className="mb-2 text-center text-2xl font-semibold text-white">Welcome back</Text>
        <Text className="mb-8 text-center text-[#a3a3a3]">Sign in with your Gumroad account to continue</Text>

        <Pressable
          onPress={login}
          disabled={isLoading}
          className="items-center justify-center rounded-xl bg-[#ff90e8] px-6 py-4 active:bg-[#ff6ad5]"
          style={({ pressed }) => ({
            opacity: isLoading ? 0.6 : pressed ? 0.9 : 1,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          })}
        >
          {isLoading ? (
            <ActivityIndicator color="#0d0d0d" />
          ) : (
            <Text className="text-lg font-semibold text-[#0d0d0d]">Sign in with Gumroad</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
