import { SolidIcon } from "@/components/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import * as React from "react";
import { Modal, Pressable, View, type ModalProps } from "react-native";

type SheetProps = Omit<ModalProps, "animationType" | "presentationStyle"> & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const Sheet = ({ open, onOpenChange, onRequestClose, children, ...props }: SheetProps) => (
  <Modal
    visible={open}
    animationType="slide"
    presentationStyle="pageSheet"
    onRequestClose={(e) => {
      onOpenChange(false);
      onRequestClose?.(e);
    }}
    {...props}
  >
    <View className="flex-1 bg-background">{children}</View>
  </Modal>
);

type SheetHeaderProps = {
  children?: React.ReactNode;
  className?: string;
  onClose: () => void;
};

const SheetHeader = ({ children, className, onClose }: SheetHeaderProps) => (
  <View className={cn("flex-row items-center justify-between border-b border-border px-4 py-3", className)}>
    <View className="flex-1">{children}</View>
    <Pressable onPress={onClose} className="p-2">
      <SolidIcon name="x" size={24} className="text-foreground" />
    </Pressable>
  </View>
);

type SheetTitleProps = React.ComponentProps<typeof Text>;

const SheetTitle = ({ className, ...props }: SheetTitleProps) => (
  <Text className={cn("font-bold text-foreground", className)} {...props} />
);

type SheetContentProps = {
  children?: React.ReactNode;
  className?: string;
};

const SheetContent = ({ children, className }: SheetContentProps) => (
  <View className={cn("flex-1", className)}>{children}</View>
);

export { Sheet, SheetContent, SheetHeader, SheetTitle };
