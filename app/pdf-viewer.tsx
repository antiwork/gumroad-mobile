import { Stack, useLocalSearchParams } from "expo-router";
import { Dimensions, StyleSheet, View } from "react-native";
import Pdf from "react-native-pdf";

export default function PdfViewerScreen() {
  const { uri, title } = useLocalSearchParams<{ uri: string; title?: string }>();

  return (
    <View className="flex-1 bg-[#25292e]">
      <Stack.Screen options={{ title: title ?? "PDF" }} />
      <Pdf
        source={{ uri }}
        style={styles.pdf}
        trustAllCerts={false}
        enablePaging
        horizontal
        onError={(error) => {
          console.error("PDF Error:", error);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pdf: {
    flex: 1,
    width: Dimensions.get("window").width,
    height: Dimensions.get("window").height,
  },
});
