import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useRouter } from "expo-router";
import { View } from "react-native";

export const GettingStartedPlaceholder = ({ message }: { message: string }) => {
  const router = useRouter();
  return (
    <View className="flex-1 items-center justify-center gap-4 p-8">
      <Text className="text-center font-sans text-2xl text-foreground">You&apos;re just getting started.</Text>
      <Text className="text-center font-sans text-base text-muted">{message}</Text>
      <Button variant="accent" className="mt-2" onPress={() => router.push("/create-product")}>
        <Text>Create your first product</Text>
      </Button>
    </View>
  );
};
