import { LineIcon, SolidIcon } from "@/components/icon";
import { Screen } from "@/components/ui/screen";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Text } from "@/components/ui/text";
import { useRefToLatest } from "@/components/use-ref-to-latest";
import { useAuth } from "@/lib/auth-context";
import { updateMediaLocation } from "@/lib/media-location";
import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Dimensions, FlatList, StyleSheet, TouchableOpacity, View } from "react-native";
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
  const { uri, title, urlRedirectId, productFileId, purchaseId, initialPage } = useLocalSearchParams<{
    uri: string;
    title?: string;
    urlRedirectId?: string;
    productFileId?: string;
    purchaseId?: string;
    initialPage?: string;
  }>();
  const { accessToken } = useAuth();
  const pdfRef = useRef<PdfRef>(null);
  const [currentPage, setCurrentPage] = useState(initialPage ? Number(initialPage) : 1);
  const currentPageRef = useRefToLatest(currentPage);
  const [totalPages, setTotalPages] = useState(0);
  const [viewMode, setViewMode] = useState<"single" | "continuous">("single");
  const [tableOfContents, setTableOfContents] = useState<TableContent[]>([]);
  const [showTocModal, setShowTocModal] = useState(false);
  const [showViewModeModal, setShowViewModeModal] = useState(false);

  useEffect(() => {
    return () => {
      if (!urlRedirectId || !productFileId) return;

      updateMediaLocation({
        urlRedirectId,
        productFileId,
        purchaseId,
        // We deliberately use the latest value of the ref for the latest media location
        // eslint-disable-next-line react-hooks/exhaustive-deps
        location: currentPageRef.current,
        accessToken,
      });
    };
  }, [urlRedirectId, productFileId, purchaseId, currentPageRef, accessToken]);

  const handleTocItemPress = (pageIdx: number) => {
    pdfRef.current?.setPage(pageIdx + 1);
    setShowTocModal(false);
  };

  const flattenedToc = flattenToc(tableOfContents);

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: title ?? "PDF",
          headerRight: () => (
            <View className="flex-row items-center">
              {tableOfContents.length > 0 && (
                <TouchableOpacity onPress={() => setShowTocModal(true)} className="p-2">
                  <SolidIcon name="book-content" size={24} className="text-accent" />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => setShowViewModeModal(true)} className="p-2">
                {viewMode === "continuous" ? (
                  <LineIcon name="move-vertical" size={24} className="text-accent" />
                ) : (
                  <SolidIcon name="carousel" size={24} className="text-accent" />
                )}
              </TouchableOpacity>
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
        page={initialPage ? Number(initialPage) : 1}
        onLoadComplete={(numberOfPages, _path, _size, toc) => {
          setTotalPages(numberOfPages);
          setTableOfContents(toc ?? []);
        }}
        onPageChanged={(page) => setCurrentPage(page)}
        onError={(error) => {
          console.error("PDF Error:", error);
        }}
      />

      <Sheet open={showTocModal} onOpenChange={setShowTocModal}>
        <SheetHeader onClose={() => setShowTocModal(false)}>
          <SheetTitle>Table of Contents</SheetTitle>
        </SheetHeader>
        <SheetContent>
          <FlatList
            data={flattenedToc}
            keyExtractor={(item, index) => `${item.pageIdx}-${index}`}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => handleTocItemPress(item.pageIdx)}>
                <View className="border-b border-border py-3 pr-4" style={{ paddingLeft: 16 + item.depth * 16 }}>
                  <Text className="text-base text-foreground" numberOfLines={2}>
                    {item.title}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View className="items-center justify-center p-8">
                <Text className="text-muted">No table of contents available</Text>
              </View>
            }
          />
        </SheetContent>
      </Sheet>

      <Sheet open={showViewModeModal} onOpenChange={setShowViewModeModal}>
        <SheetHeader onClose={() => setShowViewModeModal(false)}>
          <SheetTitle>View Mode</SheetTitle>
        </SheetHeader>
        <SheetContent className="p-4">
          <TouchableOpacity
            onPress={() => {
              setViewMode("single");
              setShowViewModeModal(false);
            }}
            className="flex-row items-center justify-between border-b border-border py-4"
          >
            <View className="flex-row items-center gap-3">
              <SolidIcon name="carousel" size={24} className="text-foreground" />
              <Text className="text-base text-foreground">Single Page</Text>
            </View>
            {viewMode === "single" && <LineIcon name="check" size={24} className="text-accent" />}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setViewMode("continuous");
              setShowViewModeModal(false);
            }}
            className="flex-row items-center justify-between border-b border-border py-4"
          >
            <View className="flex-row items-center gap-3">
              <LineIcon name="move-vertical" size={24} className="text-foreground" />
              <Text className="text-base text-foreground">Continuous</Text>
            </View>
            {viewMode === "continuous" && <LineIcon name="check" size={24} className="text-accent" />}
          </TouchableOpacity>
        </SheetContent>
      </Sheet>

      {totalPages > 0 && (
        <View className="absolute right-0 bottom-8 left-0 items-center">
          <View className="flex-row items-center gap-2 rounded bg-background/70 px-4 py-2">
            <Text className="text-lg font-semibold tracking-wide text-foreground">
              {currentPage} / {totalPages}
            </Text>
          </View>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pdf: {
    flex: 1,
    width: Dimensions.get("window").width,
    height: Dimensions.get("window").height,
  },
});
