import { cn } from "@/lib/utils";
import { Image } from "expo-image";
import { Text, TextProps } from "react-native";
import { WebView } from "react-native-webview";
import { withUniwind } from "uniwind";

// Wrappers for built-in and third party components which include className support and/or default styles

export const StyledImage = withUniwind(Image);

export const StyledWebView = withUniwind(WebView);

export const StyledText = (props: TextProps) => (
  <Text {...props} className={cn("font-sans text-base text-foreground", props.className)} />
);
