import { useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { WebView } from "react-native-webview";

export default function DownloadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const url = `https://gumroad.com/d/${id}?display=mobile_app`;

  return (
    <View className="flex-1 bg-[#25292e]">
      <WebView source={{ uri: url }} className="flex-1" webviewDebuggingEnabled pullToRefreshEnabled />
    </View>
  );
}
