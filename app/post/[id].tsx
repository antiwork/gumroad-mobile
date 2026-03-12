import { MiniAudioPlayer } from "@/components/mini-audio-player";
import { StyledWebView } from "@/components/styled";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Screen } from "@/components/ui/screen";
import { useAuth } from "@/lib/auth-context";
import { env } from "@/lib/env";
import { Stack, useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function PostScreen() {
  const { id, title } = useLocalSearchParams<{
    id: string;
    title: string;
  }>();
  const { isLoading, accessToken } = useAuth();
  const url = `${env.EXPO_PUBLIC_GUMROAD_URL}/posts/${id}?display=mobile_app&access_token=${accessToken}&mobile_token=${env.EXPO_PUBLIC_MOBILE_TOKEN}`;
  const { bottom } = useSafeAreaInsets();

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-body-bg">
        <LoadingSpinner size="large" />
      </View>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: title ?? "" }} />
      <StyledWebView
        source={{ uri: url }}
        className="flex-1 bg-transparent"
        webviewDebuggingEnabled
        pullToRefreshEnabled
        mediaPlaybackRequiresUserAction={false}
        originWhitelist={["*"]}
      />
      <View className="bg-body-bg">
        <MiniAudioPlayer />
      </View>
      <View style={{ paddingBottom: bottom }} />
    </Screen>
  );
}
