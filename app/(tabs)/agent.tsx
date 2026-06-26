import { AgentChat } from "@/components/agent/agent-chat";
import { useAgentMeta } from "@/components/agent/use-agent-meta";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import { View } from "react-native";

export default function Agent() {
  const { isLoading: isAuthLoading } = useAuth();
  const { data, isLoading, error } = useAgentMeta();

  if (isAuthLoading || isLoading) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <LoadingSpinner size="large" />
        </View>
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center p-8">
          <Text className="text-center font-sans text-foreground">
            Couldn&apos;t load the assistant. Pull down or try again later.
          </Text>
        </View>
      </Screen>
    );
  }

  if (!data?.enabled) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center p-8">
          <Text className="text-center font-sans text-lg text-foreground">Store assistant isn&apos;t available</Text>
          <Text className="mt-2 text-center text-sm text-muted">
            This account doesn&apos;t have access to the store assistant yet.
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <AgentChat greeting={data.greeting} suggestions={data.suggestions} />
    </Screen>
  );
}
