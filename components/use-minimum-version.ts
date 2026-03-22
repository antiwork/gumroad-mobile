import { useAPIRequest } from "@/lib/request";
import Constants from "expo-constants";
import * as Updates from "expo-updates";
import { useMemo } from "react";

export type UpdateRequirement = "native" | "ota" | null;

export const checkUpdateRequirement = (
  appVersion: string | undefined,
  updateCreatedAt: Date | undefined,
  minimumVersion: string,
  minimumUpdateCreatedAt: string,
): UpdateRequirement => {
  if (appVersion && appVersion < minimumVersion) return "native";
  if (updateCreatedAt && updateCreatedAt < new Date(minimumUpdateCreatedAt)) return "ota";
  return null;
};

export const useMinimumVersion = () => {
  const { data, isLoading } = useAPIRequest<{
    minimum_version: string;
    minimum_update_created_at: string;
  }>({
    queryKey: ["minimum-version"],
    url: "/internal/mobile_minimum_version",
  });

  const updateRequirement = useMemo(() => {
    if (!data) return null;
    return checkUpdateRequirement(
      Constants.expoConfig?.version,
      Updates.createdAt ?? undefined,
      data.minimum_version,
      data.minimum_update_created_at,
    );
  }, [data]);

  return { updateRequirement, isChecking: isLoading };
};
