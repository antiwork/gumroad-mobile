import { Redirect } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useAuth } from "./context/AuthContext";
import { getRedirectUri } from "./lib/auth";

export default function LoginScreen() {
  const { isAuthenticated, isLoading, login } = useAuth();

  useEffect(() => {
    WebBrowser.warmUpAsync();

    return () => {
      WebBrowser.coolDownAsync();
    };
  }, []);

  // If already authenticated, redirect to home
  if (isAuthenticated) {
    return <Redirect href="/" />;
  }

  const redirectUri = getRedirectUri();
  console.log("redirectUri", redirectUri);

  return (
    <View className="flex-1 items-center justify-center bg-[#0d0d0d] px-6">
      {/* Gumroad-inspired gradient accent */}
      <View className="absolute top-0 right-0 left-0 h-1 bg-[#ff90e8]" />

      {/* Logo / Brand */}
      <View className="mb-12 items-center">
        <Text className="mb-2 text-5xl font-bold tracking-tight text-white">Gumroad</Text>
        <Text className="text-lg text-[#a3a3a3]">Mobile</Text>
      </View>

      {/* Login Card */}
      <View className="w-full max-w-sm rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a] p-8">
        <Text className="mb-2 text-center text-2xl font-semibold text-white">Welcome back</Text>
        <Text className="mb-8 text-center text-[#a3a3a3]">Sign in with your Gumroad account to continue</Text>

        {/* Login Button */}
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

        {/* Scope info */}
        <View className="mt-6 border-t border-[#2a2a2a] pt-6">
          <Text className="text-center text-xs text-[#666]">
            This app will request access to your creator and mobile API
          </Text>
        </View>
      </View>

      {/* Debug info - remove in production */}
      <View className="mt-8 rounded-lg bg-[#1a1a1a] p-4">
        <Text className="font-mono text-xs text-[#666]">Redirect URI: {redirectUri}</Text>
      </View>

      {/* Footer */}
      <View className="absolute bottom-8">
        <Text className="text-sm text-[#666]">Powered by Gumroad OAuth 2.0</Text>
      </View>
    </View>
  );
}
