import * as Updates from "expo-updates";
import { useCallback, useEffect, useState } from "react";

// Module-level singleton ensures only one OTA check + download runs at a time,
// regardless of how many hook instances mount (multiple Screen components,
// ForceUpdateScreen, etc.). This prevents parallel multi-MB asset downloads
// from exhausting device memory and triggering a watchdog termination.
let otaPromise: Promise<boolean> | null = null;

const checkAndDownloadOnce = (): Promise<boolean> => {
  if (otaPromise) return otaPromise;

  otaPromise = (async () => {
    try {
      console.info("Checking for updates");
      const update = await Updates.checkForUpdateAsync();
      console.info("Checked for updates", update);
      if (update.isAvailable) {
        await Updates.fetchUpdateAsync();
        console.info("Fetched update");
        return true;
      }
      return false;
    } catch (e) {
      console.error("Error checking/downloading OTA update:", e);
      return false;
    } finally {
      // Allow retries on subsequent mounts if this attempt failed
      // (the promise resolves, but new callers can start fresh)
      otaPromise = null;
    }
  })();

  return otaPromise;
};

export const useOTAUpdate = () => {
  const [isUpdateReady, setIsUpdateReady] = useState(false);

  useEffect(() => {
    if (__DEV__) return;

    let cancelled = false;
    checkAndDownloadOnce().then((ready) => {
      if (!cancelled && ready) setIsUpdateReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const apply = useCallback(async () => {
    await Updates.reloadAsync();
  }, []);

  const dismiss = useCallback(() => {
    setIsUpdateReady(false);
  }, []);

  return { isUpdateReady, apply, dismiss };
};
