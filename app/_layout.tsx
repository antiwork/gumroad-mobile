import { Stack } from "expo-router";
import { AuthProvider } from "../lib/auth-context";
import { QueryProvider } from "../lib/query-client";
import "./global.css";

export default function RootLayout() {
  return (
    <QueryProvider>
      <AuthProvider>
        <Stack>
        <Stack.Screen
          name="login"
          options={{
            title: "Sign In",
            headerShown: false,
          }}
        />
        <Stack.Screen name="index" options={{ title: "Home" }} />
        <Stack.Screen name="download/[id]" options={{ title: "Download" }} />
        </Stack>
      </AuthProvider>
    </QueryProvider>
  );
}
