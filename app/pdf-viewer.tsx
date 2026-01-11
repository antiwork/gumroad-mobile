import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { Dimensions, FlatList, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Pdf, { PdfRef, TableContent } from "react-native-pdf";

type FlattenedTocItem = {
  title: string;
  pageIdx: number;
  depth: number;
};

const flattenToc = (items: TableContent[], depth = 0): FlattenedTocItem[] => {
  return items.flatMap((item) => [
    { title: item.title, pageIdx: Number(item.pageIdx), depth },
    ...flattenToc(item.children ?? [], depth + 1),
  ]);
};

export default function PdfViewerScreen() {
  const { uri, title } = useLocalSearchParams<{ uri: string; title?: string }>();
  const pdfRef = useRef<PdfRef>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [viewMode, setViewMode] = useState<"single" | "continuous">("single");
  const [tableOfContents, setTableOfContents] = useState<TableContent[]>([]);
  const [showTocModal, setShowTocModal] = useState(false);
  const [showViewModeModal, setShowViewModeModal] = useState(false);

  const handleTocItemPress = (pageIdx: number) => {
    pdfRef.current?.setPage(pageIdx + 1); // pageIdx is 0-based, setPage expects 1-based
    setShowTocModal(false);
  };

  const flattenedToc = flattenToc(tableOfContents);

  return (
    <View className="flex-1 bg-[#25292e]">
      <Stack.Screen
        options={{
          title: title ?? "PDF",
          headerRight: () => (
            <View className="flex-row items-center">
              {tableOfContents.length > 0 && (
                <Pressable onPress={() => setShowTocModal(true)} className="p-2">
                  <MaterialCommunityIcons name="table-of-contents" size={24} color="black" />
                </Pressable>
              )}
              <Pressable onPress={() => setShowViewModeModal(true)} className="p-2">
                <MaterialCommunityIcons name="eye-outline" size={24} color="black" />
              </Pressable>
            </View>
          ),
        }}
      />
      <Pdf
        key={viewMode}
        ref={pdfRef}
        source={{ uri }}
        style={styles.pdf}
        trustAllCerts={false}
        fitPolicy={0}
        enablePaging={viewMode === "single"}
        horizontal={viewMode === "single"}
        onLoadComplete={(numberOfPages, _path, _size, toc) => {
          setTotalPages(numberOfPages);
          setTableOfContents(toc ?? []);
        }}
        onPageChanged={(page) => setCurrentPage(page)}
        onError={(error) => {
          console.error("PDF Error:", error);
        }}
      />

      <Modal
        visible={showTocModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowTocModal(false)}
      >
        <View className="flex-1 bg-[#1a1d21]">
          <View className="flex-row items-center justify-between border-b border-[#3a3f47] px-4 py-4">
            <Text className="text-xl font-bold text-white">Table of Contents</Text>
            <Pressable onPress={() => setShowTocModal(false)} className="p-2">
              <MaterialCommunityIcons name="close" size={24} color="white" />
            </Pressable>
          </View>
          <FlatList
            data={flattenedToc}
            keyExtractor={(item, index) => `${item.pageIdx}-${index}`}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => handleTocItemPress(item.pageIdx)}>
                <View
                  // Nativewind classes don't seem to work in FlatList
                  style={{
                    borderBottomWidth: 1,
                    borderBottomColor: "#2a2f37",
                    paddingVertical: 12,
                    paddingRight: 16,
                    paddingLeft: 16 + item.depth * 16,
                  }}
                >
                  <Text style={{ fontSize: 16, color: "white" }} numberOfLines={2}>
                    {item.title}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View className="items-center justify-center p-8">
                <Text className="text-[#888]">No table of contents available</Text>
              </View>
            }
          />
        </View>
      </Modal>

      <Modal
        visible={showViewModeModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowViewModeModal(false)}
      >
        <View className="flex-1 bg-[#1a1d21]">
          <View className="flex-row items-center justify-between border-b border-[#3a3f47] px-4 py-4">
            <Text className="text-xl font-bold text-white">View Mode</Text>
            <Pressable onPress={() => setShowViewModeModal(false)} className="p-2">
              <MaterialCommunityIcons name="close" size={24} color="white" />
            </Pressable>
          </View>
          <View className="p-4">
            <TouchableOpacity
              onPress={() => {
                setViewMode("single");
                setShowViewModeModal(false);
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: 16,
                borderBottomWidth: 1,
                borderBottomColor: "#2a2f37",
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <MaterialCommunityIcons name="file-document-outline" size={24} color="white" />
                <Text style={{ fontSize: 16, color: "white" }}>Single Page</Text>
              </View>
              {viewMode === "single" && <MaterialCommunityIcons name="check" size={24} color="#4ade80" />}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setViewMode("continuous");
                setShowViewModeModal(false);
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: 16,
                borderBottomWidth: 1,
                borderBottomColor: "#2a2f37",
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <MaterialCommunityIcons name="view-sequential-outline" size={24} color="white" />
                <Text style={{ fontSize: 16, color: "white" }}>Continuous</Text>
              </View>
              {viewMode === "continuous" && <MaterialCommunityIcons name="check" size={24} color="#4ade80" />}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {totalPages > 0 && (
        <View className="absolute right-0 bottom-8 left-0 items-center">
          <View className="flex-row items-center gap-2 rounded bg-[rgba(0,0,0,0.7)] px-4 py-2">
            <Text className="text-lg font-semibold tracking-wide text-white">
              {currentPage} / {totalPages}
            </Text>
          </View>
        </View>
      )}
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
