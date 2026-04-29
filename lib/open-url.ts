import { Alert, Linking } from "react-native";

const isHttpUrl = (url: string) => /^https?:\/\//i.test(url);

const showFallbackAlert = (url: string) => {
  if (isHttpUrl(url)) {
    Alert.alert("No browser found", "Please install a web browser to continue.");
  } else {
    Alert.alert("Couldn't open link", "No app is available to handle this link.");
  }
};

export const safeOpenURL = async (url: string): Promise<boolean> => {
  try {
    if (isHttpUrl(url)) {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        showFallbackAlert(url);
        return false;
      }
    }
    await Linking.openURL(url);
    return true;
  } catch {
    showFallbackAlert(url);
    return false;
  }
};
