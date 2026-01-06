import { assertDefined } from "@/lib/assert";

export const env = {
  EXPO_PUBLIC_GUMROAD_URL: assertDefined(process.env.EXPO_PUBLIC_GUMROAD_URL, "EXPO_PUBLIC_GUMROAD_URL is not set"),
  EXPO_PUBLIC_GUMROAD_API_URL: assertDefined(
    process.env.EXPO_PUBLIC_GUMROAD_API_URL,
    "EXPO_PUBLIC_GUMROAD_API_URL is not set",
  ),
  EXPO_PUBLIC_GUMROAD_CLIENT_ID: assertDefined(
    process.env.EXPO_PUBLIC_GUMROAD_CLIENT_ID,
    "EXPO_PUBLIC_GUMROAD_CLIENT_ID is not set",
  ),
  EXPO_PUBLIC_MOBILE_TOKEN: assertDefined(process.env.EXPO_PUBLIC_MOBILE_TOKEN, "EXPO_PUBLIC_MOBILE_TOKEN is not set"),
  EXPO_PUBLIC_PLACEHOLDER_DOWNLOAD_ID: assertDefined(process.env.EXPO_PUBLIC_PLACEHOLDER_DOWNLOAD_ID),
};
