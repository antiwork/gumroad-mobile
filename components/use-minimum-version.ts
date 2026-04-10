import { useAPIRequest } from "@/lib/request";
import Constants from "expo-constants";
import { useMemo } from "react";

export const checkNeedsUpdate = (appVersion: string | undefined, minimumVersion: string): boolean => {
  if (appVersion && appVersion < minimumVersion) return true;
  return false;
};

export const useMinimumVersion = () => {
  const { data, isLoading } = useAPIRequest<{
    minimum_version: string;
  }>({
    queryKey: ["minimum-version"],
    url: "/internal/mobile_minimum_version",
  });

  const needsUpdate = useMemo(() => {
    if (!data) return false;
    return checkNeedsUpdate(Constants.expoConfig?.version, data.minimum_version);
  }, [data]);

  return { needsUpdate, isChecking: isLoading };
};
