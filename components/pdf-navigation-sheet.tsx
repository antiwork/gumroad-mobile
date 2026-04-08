import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader } from "@/components/ui/sheet";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { ActivityIndicator, Dimensions, FlatList, TouchableOpacity, View } from "react-native";
import Pdf, { TableContent } from "react-native-pdf";
import { File, Paths } from "expo-file-system";

const THUMBNAIL_COLUMNS = 3;
const THUMBNAIL_GAP = 12;
const THUMBNAIL_WIDTH = (Dimensions.get("window").width - THUMBNAIL_GAP * (THUMBNAIL_COLUMNS + 1)) / THUMBNAIL_COLUMNS;
const THUMBNAIL_HEIGHT = THUMBNAIL_WIDTH * 1.4;

type FlattenedTocItem = {
  title: string;
  pageIdx: number;
  depth: number;
};

const flattenToc = (items: TableContent[], depth = 0): FlattenedTocItem[] =>
  items.flatMap((item) => [
    { title: item.title, pageIdx: Number(item.pageIdx), depth },
    ...flattenToc(item.children ?? [], depth + 1),
  ]);

export const PdfNavigationSheet = ({
  open,
  onOpenChange,
  uri,
  tableOfContents,
  totalPages,
  currentPage,
  onPageSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  uri: string;
  tableOfContents: TableContent[];
  totalPages: number;
  currentPage: number;
  onPageSelect: (page: number) => void;
}) => {
  const hasToc = tableOfContents.length > 0;
  const [activeTab, setActiveTab] = useState<"contents" | "pages">("pages");
  const [cachedUri, setCachedUri] = useState<string | null>(null);

  useEffect(() => {
    if (hasToc) setActiveTab("contents");
  }, [hasToc]);

  useEffect(() => {
    let cancelled = false;
    File.downloadFileAsync(uri, Paths.cache, { idempotent: true })
      .then((result) => {
        if (!cancelled) setCachedUri(result.uri);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [uri]);

  const flattenedToc = flattenToc(tableOfContents);
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  const handleClose = () => onOpenChange(false);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetHeader onClose={handleClose}>
        {hasToc ? (
          <View className="flex-row gap-2">
            <Button
              variant={activeTab === "contents" ? "outline" : "ghost"}
              size="sm"
              className="rounded-full"
              onPress={() => setActiveTab("contents")}
            >
              <Text>Contents</Text>
            </Button>
            <Button
              variant={activeTab === "pages" ? "outline" : "ghost"}
              size="sm"
              className="rounded-full"
              onPress={() => setActiveTab("pages")}
            >
              <Text>Pages</Text>
            </Button>
          </View>
        ) : (
          <Text className="font-bold text-foreground">Pages</Text>
        )}
      </SheetHeader>
      <SheetContent>
        {hasToc && activeTab === "contents" ? (
          <FlatList
            key="contents"
            data={flattenedToc}
            keyExtractor={(item, index) => `${item.pageIdx}-${index}`}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => {
                  onPageSelect(item.pageIdx + 1);
                  handleClose();
                }}
              >
                <View className="border-b border-border py-3 pr-4" style={{ paddingLeft: 16 + item.depth * 16 }}>
                  <Text className="text-base text-foreground" numberOfLines={2}>
                    {item.title}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          />
        ) : cachedUri ? (
          <FlatList
            key="pages"
            data={pages}
            numColumns={THUMBNAIL_COLUMNS}
            keyExtractor={(item) => String(item)}
            contentContainerStyle={{ padding: THUMBNAIL_GAP }}
            columnWrapperStyle={{ gap: THUMBNAIL_GAP, marginBottom: THUMBNAIL_GAP }}
            initialNumToRender={9}
            maxToRenderPerBatch={6}
            windowSize={3}
            renderItem={({ item: page }) => (
              <TouchableOpacity
                onPress={() => {
                  onPageSelect(page);
                  handleClose();
                }}
                style={{ width: THUMBNAIL_WIDTH }}
              >
                <View
                  className={cn(
                    "overflow-hidden rounded-lg border-2",
                    page === currentPage ? "border-accent" : "border-border",
                  )}
                  style={{ width: THUMBNAIL_WIDTH, height: THUMBNAIL_HEIGHT }}
                  pointerEvents="none"
                >
                  <Pdf
                    source={{ uri: cachedUri }}
                    singlePage
                    page={page}
                    style={{ width: THUMBNAIL_WIDTH, height: THUMBNAIL_HEIGHT }}
                  />
                </View>
                <Text
                  className={cn(
                    "mt-1 text-center text-xs",
                    page === currentPage ? "font-bold text-accent" : "text-muted-foreground",
                  )}
                >
                  {page}
                </Text>
              </TouchableOpacity>
            )}
          />
        ) : (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator />
          </View>
        )}
      </SheetContent>
    </Sheet>
  );
};
