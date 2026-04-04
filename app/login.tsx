import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Text } from "@/components/ui/text";
import { Redirect } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";
import { useUniwind } from "uniwind";
import logoDark from "../assets/images/logo-dark.svg";
import logoLight from "../assets/images/logo.svg";
import { StyledImage } from "../components/styled";
import { useAuth } from "../lib/auth-context";

export default function LoginScreen() {
  const { isAuthenticated, isCreator, isLoading, login } = useAuth();
  const { theme } = useUniwind();
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleLogin = useCallback(async () => {
    setIsSigningIn(true);
    try {
      await login();
    } finally {
      setIsSigningIn(false);
    }
  }, [login]);

  if (isAuthenticated) return <Redirect href={isCreator ? "/(tabs)/dashboard" : "/(tabs)/library"} />;

  const busy = isLoading || isSigningIn;

  return (
    <View className="flex-1 items-center justify-center gap-12 bg-background px-6">
      <StyledImage source={theme === "dark" ? logoDark : logoLight} className="aspect-158/22 w-50" />

      <Button variant="accent" onPress={handleLogin} disabled={busy}>
        {busy ? <LoadingSpinner size="small" /> : <Text>Sign in with Gumroad</Text>}
      </Button>
    </View>
  );
}
