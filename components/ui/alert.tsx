import { Text, TextClassContext } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import * as React from "react";
import { View, type ViewProps } from "react-native";

function Alert({
  className,
  variant,
  children,
  icon,
  ...props
}: ViewProps &
  React.RefAttributes<View> & {
    icon: React.ReactNode;
    variant?: "default" | "destructive";
  }) {
  return (
    <TextClassContext.Provider
      value={cn("text-sm text-foreground", variant === "destructive" && "text-destructive", className)}
    >
      <View
        role="alert"
        className={cn("relative w-full rounded-lg border border-border bg-card px-4 pt-3.5 pb-2", className)}
        {...props}
      >
        <View className="absolute top-3 left-3.5">{icon}</View>
        {children}
      </View>
    </TextClassContext.Provider>
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<typeof Text> & React.RefAttributes<Text>) {
  return (
    <Text className={cn("mb-1 ml-0.5 min-h-4 pl-6 leading-none font-medium tracking-tight", className)} {...props} />
  );
}

function AlertDescription({ className, ...props }: React.ComponentProps<typeof Text> & React.RefAttributes<Text>) {
  const textClass = React.useContext(TextClassContext);
  return (
    <Text
      className={cn(
        "ml-0.5 pb-1.5 pl-6 text-sm leading-relaxed text-muted-foreground",
        textClass?.includes("text-destructive") && "text-destructive/90",
        className,
      )}
      {...props}
    />
  );
}

export { Alert, AlertDescription, AlertTitle };
