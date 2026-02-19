import { LineIcon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { type ComponentProps, useState } from "react";
import { FlatList, Pressable, View } from "react-native";

export type ContentPage = {
  id: string;
  title: string;
  icon: string;
};

export const ContentPageNavigator = ({
  pages,
  activeIndex,
  onPageChange,
}: {
  pages: ContentPage[];
  activeIndex: number;
  onPageChange: (index: number) => void;
}) => {
  const [isTocOpen, setIsTocOpen] = useState(false);
  const hasPreviousPage = activeIndex > 0;
  const hasNextPage = activeIndex < pages.length - 1;

  return (
    <>
      <View className="flex-row items-center gap-2 border-t border-border bg-background px-3 py-2">
        <Button variant="outline" size="icon" onPress={() => setIsTocOpen(true)}>
          <LineIcon name="list-ul" size={20} className="text-foreground" />
        </Button>
        <Button
          variant="outline"
          className="flex-1"
          disabled={!hasPreviousPage}
          onPress={() => onPageChange(activeIndex - 1)}
        >
          <LineIcon name="left-arrow-alt" size={20} className="text-foreground" />
          <Text>Previous</Text>
        </Button>
        <Button
          variant="outline"
          className="flex-1"
          disabled={!hasNextPage}
          onPress={() => onPageChange(activeIndex + 1)}
        >
          <Text>Next</Text>
          <LineIcon name="right-arrow-alt" size={20} className="text-foreground" />
        </Button>
      </View>

      <Sheet open={isTocOpen} onOpenChange={setIsTocOpen}>
        <SheetHeader onClose={() => setIsTocOpen(false)}>
          <SheetTitle>Table of contents</SheetTitle>
        </SheetHeader>
        <SheetContent>
          <FlatList
            data={pages}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => {
              const isActive = index === activeIndex;
              return (
                <Pressable
                  onPress={() => {
                    onPageChange(index);
                    setIsTocOpen(false);
                  }}
                  className={cn("flex-row items-center gap-3 border-b border-border px-4 py-4", isActive && "bg-muted")}
                >
                  <LineIcon
                    name={item.icon as ComponentProps<typeof LineIcon>["name"]}
                    size={18}
                    className="text-muted-foreground"
                  />
                  <Text className={cn("flex-1", isActive && "font-bold")} numberOfLines={2}>
                    {item.title}
                  </Text>
                  {isActive ? <LineIcon name="check" size={18} className="text-primary" /> : null}
                </Pressable>
              );
            }}
          />
        </SheetContent>
      </Sheet>
    </>
  );
};
