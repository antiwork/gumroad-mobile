import { env } from "@/lib/env";
import { request } from "@/lib/request";
import Constants from "expo-constants";
import * as Updates from "expo-updates";
import { useEffect, useState } from "react";

interface MinimumVersionResponse {
  minimum_version: string;
  minimum_update_created_at: string;
}

export type UpdateRequirement = "native" | "ota" | null;

const fetchMinimumVersion = async (): Promise<MinimumVersionResponse> => {
  const url = new URL("/internal/minimum_version", env.EXPO_PUBLIC_GUMROAD_API_URL);
  url.searchParams.append("mobile_token", env.EXPO_PUBLIC_MOBILE_TOKEN);
  return request<MinimumVersionResponse>(url.toString());
};

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
  const [updateRequirement, setUpdateRequirement] = useState<UpdateRequirement>(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const check = async () => {
      try {
        const { minimum_version, minimum_update_created_at } = await fetchMinimumVersion();
        const requirement = checkUpdateRequirement(
          Constants.expoConfig?.version,
          Updates.createdAt ?? undefined,
          minimum_version,
          minimum_update_created_at,
        );
        setUpdateRequirement(requirement);
      } catch (e) {
        console.error("Failed to check minimum version:", e);
      } finally {
        setIsChecking(false);
      }
    };

    check();
  }, []);

  return { updateRequirement, isChecking };
};
