import { ForceUpdateScreen } from "@/components/force-update-screen";
import { useMinimumVersion } from "@/components/use-minimum-version";
import * as NavigationBar from "expo-navigation-bar";
import { PortalHost } from "@rn-primitives/portal";
import { useNavigationContainerRef, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useCSSVariable } from "uniwind";
import { setupPlayer } from "../components/use-audio-player-sync";
import { usePushNotifications } from "../components/use-push-notifications";
import { AuthProvider } from "../lib/auth-context";
import { QueryProvider } from "../lib/query-client";
import { Sentry, navigationIntegration } from "../lib/sentry";
import "./global.css";

const PushNotificationRegistrar = () => {
  usePushNotifications();
  return null;
};

const ForceUpdateGuard = () => {
  const { updateRequirement } = useMinimumVersion();
  if (!updateRequirement) return null;
  return (
    <View style={StyleSheet.absoluteFill} className="z-50">
      <ForceUpdateScreen requirement={updateRequirement} />
    </View>
  );
};

const RootLayout = () => {
  const ref = useNavigationContainerRef();
  const [background, accent] = useCSSVariable(["--color-background", "--color-accent"]);

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
      console.error("Failed to setup player:", error);
    });
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: background as string }}>
      <QueryProvider>
        <AuthProvider>
          <PushNotificationRegistrar />
          <ForceUpdateGuard />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: "black" },
              headerShadowVisible: false,
              headerTintColor: accent as string,
              headerTitleStyle: { fontFamily: "ABC Favorit", color: "white" },
              headerBackButtonDisplayMode: "minimal",
              contentStyle: { backgroundColor: background as string },
            }}
          >
            <Stack.Screen name="login" options={{ title: "Sign In", headerShown: false, animation: "none" }} />
            <Stack.Screen name="index" options={{ headerShown: false, animation: "none" }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: "none" }} />
            <Stack.Screen name="purchase/[token]" options={{ title: "" }} />
            <Stack.Screen name="post/[id]" options={{ title: "" }} />
            <Stack.Screen name="pdf-viewer" options={{ title: "PDF" }} />
          </Stack>
          <StatusBar style="light" />
          <PortalHost />
        </AuthProvider>
      </QueryProvider>
    </GestureHandlerRootView>
  );
};

export default Sentry.wrap(RootLayout);
