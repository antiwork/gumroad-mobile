import { Redirect } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect } from "react";
import { ActivityIndicator, TouchableOpacity, View } from "react-native";
import { useUniwind } from "uniwind";
import logoDark from "../assets/images/logo-dark.svg";
import logoLight from "../assets/images/logo.svg";
import { StyledImage, StyledText } from "../components/styled";
import { useAuth } from "../lib/auth-context";

export default function LoginScreen() {
  const { isAuthenticated, isLoading, login } = useAuth();
  const { theme } = useUniwind();

  useEffect(() => {
    // Speeds up opening the browser for the auth flow on Android
    WebBrowser.warmUpAsync();

    return () => {
      WebBrowser.coolDownAsync();
    };
  }, []);

  if (isAuthenticated) return <Redirect href="/" />;

  return (
    <View className="flex-1 items-center justify-center gap-12 bg-background px-6">
      <StyledImage source={theme === "dark" ? logoDark : logoLight} className="aspect-158/22 w-50" />

      <TouchableOpacity
        onPress={login}
        disabled={isLoading}
        className="items-center justify-center rounded bg-accent px-6 py-4"
      >
        {isLoading ? (
          <ActivityIndicator className="text-accent-foreground" />
        ) : (
          <StyledText className="text-accent-foreground">Sign in with Gumroad</StyledText>
        )}
      </TouchableOpacity>
    </View>
  );
}
