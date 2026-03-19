import * as NavigationBar from "expo-navigation-bar";
import { PortalHost } from "@rn-primitives/portal";
import { useNavigationContainerRef, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useCSSVariable } from "uniwind";
import { setupPlayer } from "../components/use-audio-player-sync";
import { AuthProvider } from "../lib/auth-context";
import { QueryProvider } from "../lib/query-client";
import { Sentry, navigationIntegration } from "../lib/sentry";
import "./global.css";

const RootLayout = () => {
  const ref = useNavigationContainerRef();
  const [background, foreground, accent] = useCSSVariable([
    "--color-background",
    "--color-foreground",
    "--color-accent",
  ]);

  useEffect(() => {
    if (ref?.current) {
      navigationIntegration.registerNavigationContainer(ref);
    }
  }, [ref]);

  useEffect(() => {
    if (Platform.OS === "android") {
      NavigationBar.setBackgroundColorAsync(background as string);
    }
  }, [background]);

  useEffect(() => {
    setupPlayer().catch((error) => {
      Sentry.captureException(error);
      console.error("Failed to setup player:", error);
    });
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: background as string }}>
      <QueryProvider>
        <AuthProvider>
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: background as string },
              headerShadowVisible: false,
              headerTintColor: accent as string,
              headerTitleStyle: { fontFamily: "ABC Favorit", color: foreground as string },
              headerBackButtonDisplayMode: "minimal",
              contentStyle: { backgroundColor: background as string },
            }}
          >
            <Stack.Screen name="login" options={{ title: "Sign In", headerShown: false }} />
            <Stack.Screen name="index" options={{ headerShown: false, animation: "none" }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: "none" }} />
            <Stack.Screen name="purchase/[id]" options={{ title: "" }} />
            <Stack.Screen name="post/[id]" options={{ title: "" }} />
            <Stack.Screen name="pdf-viewer" options={{ title: "PDF" }} />
          </Stack>
          <StatusBar style="auto" />
          <PortalHost />
        </AuthProvider>
      </QueryProvider>
    </GestureHandlerRootView>
  );
};

export default Sentry.wrap(RootLayout);
