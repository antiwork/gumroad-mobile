import { Alert, Linking } from "react-native";

export const safeOpenURL = async (url: string): Promise<boolean> => {
  try {
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      Alert.alert("No browser found", "Please install a web browser to continue.");
      return false;
    }
    await Linking.openURL(url);
    return true;
  } catch {
    Alert.alert("No browser found", "Please install a web browser to continue.");
    return false;
  }
};
