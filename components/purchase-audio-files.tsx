import { LineIcon } from "@/components/icon";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { FlatList, Pressable } from "react-native";

export type PurchaseAudioFile = {
  id: string;
  name?: string;
};

export const PurchaseAudioFiles = ({
  files,
  onPlay,
  activeResourceId,
}: {
  files: PurchaseAudioFile[];
  onPlay: (id: string) => void;
  activeResourceId: string | null;
}) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        testID="purchase-audio-files"
        onPress={() => setOpen(true)}
        className="flex-row items-center gap-2 border-t border-border bg-body-bg px-4 py-3"
        accessibilityRole="button"
        accessibilityLabel={`${files.length} audio files`}
      >
        <LineIcon name="music-alt" size={18} className="text-foreground" />
        <Text className="text-sm font-bold text-foreground">
          {files.length} audio file{files.length === 1 ? "" : "s"}
        </Text>
      </Pressable>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetHeader onClose={() => setOpen(false)}>
          <SheetTitle>Audio files</SheetTitle>
        </SheetHeader>
        <SheetContent>
          <FlatList
            data={files}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const isActive = item.id === activeResourceId;
              return (
                <Pressable
                  testID={`purchase-audio-file-${item.id}`}
                  onPress={() => {
                    onPlay(item.id);
                    setOpen(false);
                  }}
                  className={cn("flex-row items-center gap-3 px-4 py-3", isActive && "bg-muted/20")}
                  accessibilityRole="button"
                  accessibilityLabel={item.name ?? "Audio file"}
                >
                  <LineIcon name="music-alt" size={20} className="text-foreground" />
                  <Text className={cn("flex-1", isActive && "font-bold")} numberOfLines={2}>
                    {item.name ?? "Audio file"}
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
