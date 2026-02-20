import { LineIcon } from "@/components/icon";
import { Text } from "@/components/ui/text";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { FlatList, Pressable, View } from "react-native";

export type ContentPage = {
  id: string;
  name: string;
};

type TableOfContentsBarProps = {
  pages: ContentPage[];
  currentPageIndex: number;
  onNavigate: (pageIndex: number) => void;
};

export const TableOfContentsBar = ({ pages, currentPageIndex, onNavigate }: TableOfContentsBarProps) => {
  const [sheetOpen, setSheetOpen] = useState(false);

  if (pages.length <= 1) return null;

  const hasPrev = currentPageIndex > 0;
  const hasNext = currentPageIndex < pages.length - 1;
  const currentPage = pages[currentPageIndex];

  return (
    <>
      <View className="flex-row items-center border-t border-border bg-body-bg px-2 py-1">
        <Pressable
          onPress={() => hasPrev && onNavigate(currentPageIndex - 1)}
          className={cn("p-3", !hasPrev && "opacity-30")}
          disabled={!hasPrev}
          accessibilityLabel="Previous page"
          accessibilityRole="button"
        >
          <LineIcon name="chevron-up" size={22} className="text-foreground" />
        </Pressable>

        <Pressable onPress={() => setSheetOpen(true)} className="flex-1 flex-row items-center justify-center px-2 py-2" accessibilityLabel="Table of contents" accessibilityRole="button">
          <LineIcon name="book-content" size={18} className="mr-2 text-foreground" />
          <Text className="text-sm text-foreground" numberOfLines={1}>
            {currentPage?.name ?? `Page ${currentPageIndex + 1}`}
          </Text>
          <Text className="ml-1 text-xs text-muted-foreground">
            ({currentPageIndex + 1}/{pages.length})
          </Text>
        </Pressable>

        <Pressable
          onPress={() => hasNext && onNavigate(currentPageIndex + 1)}
          className={cn("p-3", !hasNext && "opacity-30")}
          disabled={!hasNext}
          accessibilityLabel="Next page"
          accessibilityRole="button"
        >
          <LineIcon name="chevron-down" size={22} className="text-foreground" />
        </Pressable>
      </View>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetHeader onClose={() => setSheetOpen(false)}>
          <SheetTitle>Table of Contents</SheetTitle>
        </SheetHeader>
        <SheetContent>
          <FlatList
            data={pages}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => (
              <Pressable
                onPress={() => {
                  onNavigate(index);
                  setSheetOpen(false);
                }}
                className={cn(
                  "border-b border-border px-4 py-3",
                  index === currentPageIndex && "bg-accent",
                )}
                accessibilityRole="button"
              >
                <Text
                  className={cn(
                    "text-base text-foreground",
                    index === currentPageIndex && "font-bold",
                  )}
                >
                  {item.name}
                </Text>
              </Pressable>
            )}
          />
        </SheetContent>
      </Sheet>
    </>
  );
};
