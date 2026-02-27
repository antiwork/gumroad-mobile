import { LineIcon, LineIconName } from "@/components/icon";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { FlatList, Pressable, View } from "react-native";

export type TocPage = {
  page_id: string;
  title: string | null;
  icon: PageIconType;
};

type PageIconType = "license-key" | "text-only" | "video-file" | "music-file" | "mixed-files";

const PAGE_ICON_COMPONENTS: Record<PageIconType, LineIconName> = {
  "license-key": "key",
  "text-only": "file-detail",
  "video-file": "movie-play",
  "music-file": "music-alt",
  "mixed-files": "file-detail",
};

export const ContentPageNav = ({
  pages,
  activePageIndex,
  onPageChange,
}: {
  pages: TocPage[];
  activePageIndex: number;
  onPageChange: (index: number) => void;
}) => {
  const [sheetOpen, setSheetOpen] = useState(false);
  const hasPrevious = activePageIndex > 0;
  const hasNext = activePageIndex < pages.length - 1;

  return (
    <>
      <View className="flex-row items-center border-t border-border bg-body-bg">
        <Pressable onPress={() => setSheetOpen(true)} className="flex-1 flex-row items-center gap-1.5 px-4 py-3">
          <LineIcon name="list-ul" size={18} className="text-foreground" />
          <Text className="text-sm font-bold text-foreground" numberOfLines={1}>
            {pages[activePageIndex].title}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => onPageChange(activePageIndex - 1)}
          disabled={!hasPrevious}
          className={cn("flex-row items-center gap-1 px-4 py-3", !hasPrevious && "opacity-50")}
        >
          <LineIcon name="chevron-left" size={20} className="text-foreground" />
          <Text className="text-sm text-foreground">Previous</Text>
        </Pressable>

        <Pressable
          onPress={() => onPageChange(activePageIndex + 1)}
          disabled={!hasNext}
          className={cn("flex-row items-center gap-1 px-4 py-3", !hasNext && "opacity-50")}
        >
          <Text className="text-sm text-foreground">Next</Text>
          <LineIcon name="chevron-right" size={20} className="text-foreground" />
        </Pressable>
      </View>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetHeader onClose={() => setSheetOpen(false)}>
          <SheetTitle>Table of contents</SheetTitle>
        </SheetHeader>
        <SheetContent>
          <FlatList
            data={pages}
            keyExtractor={(item) => item.page_id}
            renderItem={({ item, index }) => {
              const isActive = index === activePageIndex;
              return (
                <Pressable
                  onPress={() => {
                    onPageChange(index);
                    setSheetOpen(false);
                  }}
                  className={cn("flex-row items-center gap-3 px-4 py-3", isActive && "bg-muted/20")}
                >
                  <LineIcon
                    name={PAGE_ICON_COMPONENTS[item.icon] ?? "file-detail"}
                    size={20}
                    className="text-foreground"
                  />
                  <Text className={cn("flex-1", isActive && "font-bold")} numberOfLines={2}>
                    {item.title ?? "Untitled"}
                  </Text>
                </Pressable>
              );
            }}
          />
        </SheetContent>
      </Sheet>
    </>
  );
};
