import { Text, TextClassContext } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { View, type ViewProps } from "react-native";

function Card({ className, ...props }: ViewProps & React.RefAttributes<View>) {
  return (
    <TextClassContext.Provider value="text-card-foreground">
      <View
        className={cn("flex flex-col rounded border border-border bg-card shadow-sm shadow-black/5", className)}
        {...props}
      />
    </TextClassContext.Provider>
  );
}

function CardHeader({ className, ...props }: ViewProps & React.RefAttributes<View>) {
  return <View className={cn("flex flex-col gap-1.5 border-b border-border p-4", className)} {...props} />;
}

function CardTitle({ className, ...props }: React.ComponentProps<typeof Text> & React.RefAttributes<Text>) {
  return <Text role="heading" aria-level={3} className={cn("text-lg leading-none", className)} {...props} />;
}

function CardDescription({ className, ...props }: React.ComponentProps<typeof Text> & React.RefAttributes<Text>) {
  return <Text className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

function CardContent({ className, ...props }: ViewProps & React.RefAttributes<View>) {
  return <View className={cn("p-4", className)} {...props} />;
}

function CardFooter({ className, ...props }: ViewProps & React.RefAttributes<View>) {
  return <View className={cn("flex flex-row items-center p-4", className)} {...props} />;
}

export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle };
