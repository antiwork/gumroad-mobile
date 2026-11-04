import * as NavigationBar from "expo-navigation-bar";
import * as ScreenOrientation from "expo-screen-orientation";
import * as Sentry from "@sentry/react-native";
import { Platform, StatusBar } from "react-native";

// An iPad's landscape is its default form factor, so there fullscreen only unlocks rotation; a phone
// is locked to portrait by the app and has to be asked for landscape.
export const prepareFullscreenOrientation = async (): Promise<boolean> => {
  try {
    if (Platform.OS === "ios" && Platform.isPad) {
      await ScreenOrientation.unlockAsync();
    } else {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    }
    return true;
  } catch (error) {
    Sentry.captureException(error);
    return false;
  }
};

export const restoreAppOrientation = () => {
  const request =
    Platform.OS === "ios" && Platform.isPad
      ? ScreenOrientation.unlockAsync()
      : ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  request.catch((error) => Sentry.captureException(error));
};

export const hideFullscreenSystemBars = async (): Promise<boolean> => {
  try {
    StatusBar.setHidden(true, "fade");
    if (Platform.OS === "android") await NavigationBar.setVisibilityAsync("hidden");
    return true;
  } catch (error) {
    StatusBar.setHidden(false, "fade");
    Sentry.captureException(error);
    return false;
  }
};

export const restoreFullscreenSystemBars = () => {
  StatusBar.setHidden(false, "fade");
  if (Platform.OS === "android") {
    NavigationBar.setVisibilityAsync("visible").catch((error) => Sentry.captureException(error));
  }
};
