import * as Updates from "expo-updates";
import { useCallback, useEffect, useState } from "react";
import * as Sentry from "@sentry/react-native";

export const useOTAUpdate = () => {
  const [isUpdateReady, setIsUpdateReady] = useState(false);

  useEffect(() => {
    if (__DEV__) return;

    const checkAndDownload = async () => {
      try {
        Sentry.addBreadcrumb({ message: "Checking for updates" });
        const update = await Updates.checkForUpdateAsync();
        Sentry.addBreadcrumb({ message: "Checked for updates", data: update });
        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();
          setIsUpdateReady(true);
          Sentry.addBreadcrumb({ message: "Fetched update" });
        }
      } catch (e) {
        Sentry.captureException(e);
        console.error("Error checking/downloading OTA update:", e);
      }
    };

    checkAndDownload();
  }, []);

  const apply = useCallback(async () => {
    await Updates.reloadAsync();
  }, []);

  const dismiss = useCallback(() => {
    setIsUpdateReady(false);
  }, []);

  return { isUpdateReady, apply, dismiss };
};
