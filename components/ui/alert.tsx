import { Text, TextClassContext } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { View, type ViewProps } from "react-native";

const alertVariants = cva("relative w-full rounded-lg border px-4 py-3", {
  variants: {
    variant: {
      default: "border-border bg-card",
      destructive: "border-destructive",
      info: "border-info",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

const alertTextVariants = cva("text-base", {
  variants: {
    variant: {
      default: "text-foreground",
      destructive: "text-destructive",
      info: "text-info",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

function Alert({
  className,
  variant,
  children,
  icon,
  ...props
}: ViewProps &
  React.RefAttributes<View> &
  VariantProps<typeof alertVariants> & {
    icon: React.ReactNode;
  }) {
  return (
    <TextClassContext.Provider value={alertTextVariants({ variant })}>
      <View role="alert" className={cn(alertVariants({ variant }), className)} {...props}>
        <View className="absolute top-3 left-3.5">{icon}</View>
        {children}
      </View>
    </TextClassContext.Provider>
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<typeof Text> & React.RefAttributes<Text>) {
  return <Text className={cn("ml-0.5 pl-6 font-medium", className)} {...props} />;
}

function AlertDescription({ className, ...props }: React.ComponentProps<typeof Text> & React.RefAttributes<Text>) {
  return <Text className={cn("ml-0.5 pl-6 text-sm leading-relaxed", className)} {...props} />;
}

export { Alert, AlertDescription, AlertTitle, alertVariants };
