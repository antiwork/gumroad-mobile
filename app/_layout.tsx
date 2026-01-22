import { StyledIcon } from "@/components/styled";
import { Stack } from "expo-router";
import { useEffect } from "react";
import { TouchableOpacity } from "react-native";
import { useCSSVariable } from "uniwind";
import { setupPlayer } from "../components/use-audio-player-sync";
import { AuthProvider, useAuth } from "../lib/auth-context";
import { QueryProvider } from "../lib/query-client";
import "./global.css";

const SignOutButton = () => {
  const { logout } = useAuth();
  // TODO: sheet with delete account prompt as well as logout
  return (
    <TouchableOpacity onPress={logout}>
      <StyledIcon name="cog" size={24} className="text-foreground" />
    </TouchableOpacity>
  );
};

export default function RootLayout() {
  const [background, foreground, accent] = useCSSVariable([
    "--color-background",
    "--color-foreground",
    "--color-accent",
  ]);

  useEffect(() => {
    setupPlayer().catch((error) => {
      console.error("Failed to setup player:", error);
    });
  }, []);

  return (
    <QueryProvider>
      <AuthProvider>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: background as string },
            headerTintColor: accent as string,
            headerTitleStyle: { color: foreground as string },
          }}
        >
          <Stack.Screen name="login" options={{ title: "Sign In", headerShown: false }} />
          <Stack.Screen name="index" options={{ title: "Library", headerRight: () => <SignOutButton /> }} />
          <Stack.Screen name="purchase/[id]" options={{ title: "", headerBackButtonDisplayMode: "minimal" }} />
          <Stack.Screen name="pdf-viewer" options={{ title: "PDF", headerBackButtonDisplayMode: "minimal" }} />
        </Stack>
      </AuthProvider>
    </QueryProvider>
  );
}
