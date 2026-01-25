import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Redirect } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { useUniwind } from "uniwind";
import logoDark from "../assets/images/logo-dark.svg";
import logoLight from "../assets/images/logo.svg";
import { StyledImage } from "../components/styled";
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

      <Button variant="accent" onPress={login} disabled={isLoading}>
        {isLoading ? <ActivityIndicator className="text-accent-foreground" /> : <Text>Sign in with Gumroad</Text>}
      </Button>
    </View>
  );
}
