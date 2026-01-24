import { Image } from "expo-image";
import { WebView } from "react-native-webview";
import { withUniwind } from "uniwind";

// Wrappers for built-in and third party components which include className support and/or default styles

export const StyledImage = withUniwind(Image);

export const StyledWebView = withUniwind(WebView);
