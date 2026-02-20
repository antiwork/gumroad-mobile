import { LineIcon } from "@/components/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { FlatList, Modal, Pressable, TouchableOpacity, View } from "react-native";

export type ContentPage = {
  id: string;
  title: string;
};

type ContentPagesFooterProps = {
  pages: ContentPage[];
  activeIndex: number;
  onPageChange: (index: number) => void;
};

export const ContentPagesFooter = ({ pages, activeIndex, onPageChange }: ContentPagesFooterProps) => {
  const [tocVisible, setTocVisible] = useState(false);
  const hasPrevious = activeIndex > 0;
  const hasNext = activeIndex < pages.length - 1;

  if (pages.length <= 1) return null;

  return (
    <>
      <View className="flex-row items-center gap-2 border-t border-border bg-background px-3 py-2">
        <TouchableOpacity
          onPress={() => setTocVisible(true)}
          className="size-10 items-center justify-center rounded border border-border"
          accessibilityLabel="Table of Contents"
        >
          <LineIcon name="list-ul" size={20} className="text-foreground" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => onPageChange(activeIndex - 1)}
          disabled={!hasPrevious}
          className={cn(
            "h-10 flex-1 flex-row items-center justify-center gap-1 rounded border border-border",
            !hasPrevious && "opacity-40",
          )}
        >
          <LineIcon name="chevron-left" size={16} className="text-foreground" />
          <Text className="text-sm text-foreground">Previous</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => onPageChange(activeIndex + 1)}
          disabled={!hasNext}
          className={cn(
            "h-10 flex-1 flex-row items-center justify-center gap-1 rounded border border-border",
            !hasNext && "opacity-40",
          )}
        >
          <Text className="text-sm text-foreground">Next</Text>
          <LineIcon name="chevron-right" size={16} className="text-foreground" />
        </TouchableOpacity>
      </View>

      <Modal visible={tocVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setTocVisible(false)}>
        <View className="flex-1 bg-background">
          <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
            <Text className="text-lg font-bold text-foreground">Table of Contents</Text>
            <Pressable onPress={() => setTocVisible(false)} className="p-2">
              <LineIcon name="x" size={24} className="text-foreground" />
            </Pressable>
          </View>
          <FlatList
            data={pages}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => (
              <Pressable
                onPress={() => {
                  onPageChange(index);
                  setTocVisible(false);
                }}
                className={cn(
                  "flex-row items-center gap-3 border-b border-border px-4 py-3",
                  index === activeIndex && "bg-accent/10",
                )}
              >
                <Text className={cn("text-base", index === activeIndex ? "font-bold text-accent" : "text-foreground")}>
                  {item.title || "Untitled"}
                </Text>
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </>
  );
};
