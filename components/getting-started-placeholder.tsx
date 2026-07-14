import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { env } from "@/lib/env";
import { safeOpenURL } from "@/lib/open-url";
import { View } from "react-native";

export const GettingStartedPlaceholder = ({ message }: { message: string }) => (
  <View className="flex-1 items-center justify-center gap-4 p-8">
    <Text className="text-center font-sans text-2xl text-foreground">You&apos;re just getting started.</Text>
    <Text className="text-center font-sans text-base text-muted">{message}</Text>
    <Button
      variant="accent"
      className="mt-2"
      onPress={() => safeOpenURL(`${env.EXPO_PUBLIC_GUMROAD_URL}/products/new`)}
    >
      <Text>Create your first product</Text>
    </Button>
  </View>
);
