import { LineIcon } from "@/components/icon";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { FlatList, Pressable, View } from "react-native";

type TocPage = {
  page_id: string;
  title: string | null;
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
      <View className="flex-row items-center border-t border-border bg-background px-4 py-2">
        <Pressable
          onPress={() => onPageChange(activePageIndex - 1)}
          disabled={!hasPrevious}
          className={cn("flex-row items-center gap-1", !hasPrevious && "opacity-50")}
        >
          <LineIcon name="chevron-left" size={20} className="text-foreground" />
          <Text className="text-sm text-foreground">Previous</Text>
        </Pressable>

        <Pressable
          onPress={() => setSheetOpen(true)}
          className="flex-1 flex-row items-center justify-center gap-1.5 self-center rounded-full border border-border px-3 py-1"
        >
          <LineIcon name="list-ul" size={16} className="text-foreground" />
          <Text className="text-sm font-bold text-foreground">
            {activePageIndex + 1} of {pages.length}
          </Text>
          <LineIcon name="chevron-down" size={14} className="text-muted-foreground" />
        </Pressable>

        <Pressable
          onPress={() => onPageChange(activePageIndex + 1)}
          disabled={!hasNext}
          className={cn("flex-row items-center gap-1", !hasNext && "opacity-50")}
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
                  className={cn("flex-row items-center gap-3 px-4 py-3", isActive && "bg-accent")}
                >
                  <Text className={cn("text-sm", isActive ? "font-bold text-accent-foreground" : "text-foreground")}>
                    {index + 1}.
                  </Text>
                  <Text
                    className={cn(
                      "flex-1 text-sm",
                      isActive ? "font-bold text-accent-foreground" : "text-foreground",
                    )}
                    numberOfLines={2}
                  >
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
