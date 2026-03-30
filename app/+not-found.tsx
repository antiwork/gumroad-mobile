import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useRouter } from "expo-router";
import { View } from "react-native";

export default function NotFoundScreen() {
  const router = useRouter();

  return (
    <Screen>
      <View className="flex-1 items-center justify-center gap-6 px-6">
        <Text variant="h2">Page not found</Text>
        <Text variant="muted">The page you're looking for doesn't exist.</Text>
        <Button variant="accent" onPress={() => router.back()}>
          <Text>Go back</Text>
        </Button>
      </View>
    </Screen>
  );
}
