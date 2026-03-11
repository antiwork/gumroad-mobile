import * as Updates from "expo-updates";
import { useCallback, useEffect, useState } from "react";
export const useOTAUpdate = () => {
  const [isUpdateReady, setIsUpdateReady] = useState(false);

  useEffect(() => {
    if (__DEV__) return;

    const checkAndDownload = async () => {
      try {
        console.info("Checking for updates");
        const update = await Updates.checkForUpdateAsync();
        console.info("Checked for updates", update);
        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();
          setIsUpdateReady(true);
          console.info("Fetched update");
        }
      } catch (e) {
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
