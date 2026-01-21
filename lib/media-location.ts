import { env } from "@/lib/env";
import { request } from "@/lib/request";
import { Platform } from "react-native";

export type MediaLocationParams = {
  urlRedirectId: string;
  productFileId: string;
  purchaseId?: string;
  location: number;
};

type MediaLocationRequest = {
  mobile_token: string;
  platform: "iphone" | "android";
  url_redirect_id: string;
  product_file_id: string;
  purchase_id?: string;
  location: number;
};

export const updateMediaLocation = async ({
  urlRedirectId,
  productFileId,
  purchaseId,
  location,
}: MediaLocationParams): Promise<void> => {
  const body: MediaLocationRequest = {
    mobile_token: env.EXPO_PUBLIC_MOBILE_TOKEN,
    platform: Platform.OS === "ios" ? "iphone" : "android",
    url_redirect_id: urlRedirectId,
    product_file_id: productFileId,
    location,
  };

  if (purchaseId) {
    body.purchase_id = purchaseId;
  }

  try {
    await request(`${env.EXPO_PUBLIC_GUMROAD_API_URL}/mobile/media_locations`, {
      method: "POST",
      data: body,
    });
  } catch (error) {
    // Log but don't throw - media location sync is non-critical
    console.warn("Failed to update media location:", error);
  }
};
