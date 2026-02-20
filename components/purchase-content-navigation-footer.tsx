import { LineIcon, SolidIcon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import type { ContentPageNavigationStatePayload } from "@/lib/purchase-content-navigation";
import { View } from "react-native";

type PurchaseContentNavigationFooterProps = {
  state: ContentPageNavigationStatePayload;
  bottomInset: number;
  onGoPrevious: () => void;
  onGoNext: () => void;
  onOpenTableOfContents: () => void;
};

const CONTENTS_ICON_SIZE = 22;
const PAGE_NAVIGATION_ICON_SIZE = 20;

export const PurchaseContentNavigationFooter = ({
  state,
  bottomInset,
  onGoPrevious,
  onGoNext,
  onOpenTableOfContents,
}: PurchaseContentNavigationFooterProps) => {
  if (!state.isVisible) return null;

  return (
    <View className="border-t border-border bg-background px-3 pt-3" style={{ paddingBottom: bottomInset }}>
      <View className="flex-row items-center gap-2 pb-3">
        {state.hasTableOfContents ? (
          <Button variant="outline" size="icon" onPress={onOpenTableOfContents}>
            <SolidIcon name="book-content" size={CONTENTS_ICON_SIZE} className="text-foreground" />
          </Button>
        ) : null}

        <Button variant="outline" className="flex-1" onPress={onGoPrevious} disabled={!state.canGoPrevious}>
          <LineIcon name="left-arrow-alt" size={PAGE_NAVIGATION_ICON_SIZE} className="text-foreground" />
          <Text>Previous</Text>
        </Button>

        <Button variant="outline" className="flex-1" onPress={onGoNext} disabled={!state.canGoNext}>
          <Text>Next</Text>
          <LineIcon name="right-arrow-alt" size={PAGE_NAVIGATION_ICON_SIZE} className="text-foreground" />
        </Button>
      </View>
    </View>
  );
};
