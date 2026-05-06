import { Stack } from "expo-router";
import { useCSSVariable } from "uniwind";

export default function ComposeLayout() {
  const accent = useCSSVariable("--color-accent") as string;
  const background = useCSSVariable("--color-background") as string;
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "black" },
        headerShadowVisible: false,
        headerTintColor: accent,
        headerTitleStyle: { fontFamily: "ABC Favorit", color: "white" },
        headerBackButtonDisplayMode: "minimal",
        contentStyle: { backgroundColor: background },
      }}
    >
      <Stack.Screen name="email-compose" options={{ title: "New email" }} />
      <Stack.Screen name="email-attachments" options={{ title: "Attachments" }} />
    </Stack>
  );
}
