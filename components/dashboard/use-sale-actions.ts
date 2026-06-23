import { assertDefined } from "@/lib/assert";
import { useAuth } from "@/lib/auth-context";
import { requestAPI, useAPIRequest } from "@/lib/request";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Alert } from "react-native";

interface ActionResult {
  success: boolean;
  message?: string;
}

export interface MissedPost {
  id: string;
  name: string;
  url: string;
  published_at: string;
}

export interface SaleUpdate {
  email?: string;
  giftee_email?: string;
  quantity?: number;
  full_name?: string;
  street_address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
}

export const saleActions = {
  updateSale: (saleId: string, update: SaleUpdate, accessToken: string) =>
    requestAPI<ActionResult>(`mobile/sales/${saleId}.json`, { method: "PUT", data: update, accessToken }),
  changeCanContact: (saleId: string, canContact: boolean, accessToken: string) =>
    requestAPI<ActionResult>(`mobile/sales/${saleId}/change_can_contact`, {
      method: "POST",
      data: { can_contact: canContact },
      accessToken,
    }),
  revokeAccess: (saleId: string, accessToken: string) =>
    requestAPI<ActionResult>(`mobile/sales/${saleId}/revoke_access`, { method: "PUT", accessToken }),
  undoRevokeAccess: (saleId: string, accessToken: string) =>
    requestAPI<ActionResult>(`mobile/sales/${saleId}/undo_revoke_access`, { method: "PUT", accessToken }),
  resendReceipt: (saleId: string, accessToken: string) =>
    requestAPI<ActionResult>(`mobile/sales/${saleId}/resend_receipt`, { method: "POST", accessToken }),
  sendPost: (saleId: string, postId: string, accessToken: string) =>
    requestAPI<ActionResult>(`mobile/sales/${saleId}/send_post`, {
      method: "POST",
      data: { post_id: postId },
      accessToken,
    }),
  markAsShipped: (saleId: string, trackingUrl: string | null, accessToken: string) =>
    requestAPI<ActionResult>(`mobile/sales/${saleId}/mark_as_shipped`, {
      method: "POST",
      data: trackingUrl ? { tracking_url: trackingUrl } : {},
      accessToken,
    }),
  resendPing: (saleId: string, accessToken: string) =>
    requestAPI<ActionResult>(`mobile/sales/${saleId}/resend_ping`, { method: "POST", accessToken }),
  updateVariant: (saleId: string, variantId: string, quantity: number, accessToken: string) =>
    requestAPI<ActionResult>(`mobile/sales/${saleId}/variant`, {
      method: "PUT",
      data: { variant_id: variantId, quantity },
      accessToken,
    }),
  updateReviewResponse: (saleId: string, message: string, accessToken: string) =>
    requestAPI<ActionResult>(`mobile/sales/${saleId}/review_response`, {
      method: "PUT",
      data: { message },
      accessToken,
    }),
  deleteReviewResponse: (saleId: string, accessToken: string) =>
    requestAPI<ActionResult>(`mobile/sales/${saleId}/review_response`, { method: "DELETE", accessToken }),
  updateLicense: (licenseId: string, enabled: boolean, accessToken: string) =>
    requestAPI<ActionResult>(`mobile/licenses/${licenseId}.json`, { method: "PUT", data: { enabled }, accessToken }),
  cancelSubscription: (subscriptionId: string, accessToken: string) =>
    requestAPI<ActionResult>(`mobile/subscriptions/${subscriptionId}/cancel`, { method: "POST", accessToken }),
  updateCallUrl: (callId: string, callUrl: string, accessToken: string) =>
    requestAPI<ActionResult>(`mobile/calls/${callId}.json`, {
      method: "PUT",
      data: { call_url: callUrl },
      accessToken,
    }),
  completeCommission: (commissionId: string, accessToken: string) =>
    requestAPI<ActionResult>(`mobile/commissions/${commissionId}/complete`, { method: "POST", accessToken }),
  approveReviewVideo: (videoId: string, accessToken: string) =>
    requestAPI<ActionResult>(`mobile/review_videos/${videoId}/approve`, { method: "POST", accessToken }),
  rejectReviewVideo: (videoId: string, accessToken: string) =>
    requestAPI<ActionResult>(`mobile/review_videos/${videoId}/reject`, { method: "POST", accessToken }),
  blobUrl: (key: string, accessToken: string) =>
    requestAPI<ActionResult & { url?: string }>(`mobile/sales/blob_url?key=${encodeURIComponent(key)}`, {
      method: "GET",
      accessToken,
    }),
};

export const useMissedPosts = (saleId: string | null) =>
  useAPIRequest<{ success: boolean; missed_posts: MissedPost[] }, MissedPost[]>({
    queryKey: ["missedPosts", saleId],
    url: `mobile/sales/${saleId}/missed_posts`,
    enabled: !!saleId,
    select: (data) => data.missed_posts,
  });

export const useSaleOptions = (saleId: string | null, enabled: boolean) =>
  useAPIRequest<{ success: boolean; options: { id: string; name: string }[] }, { id: string; name: string }[]>({
    queryKey: ["saleOptions", saleId],
    url: `mobile/sales/${saleId}/options`,
    enabled: !!saleId && enabled,
    select: (data) => data.options,
  });

export const useSaleAction = (saleId: string | null) => {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const [isBusy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const run = async (
    action: (accessToken: string) => Promise<ActionResult>,
    { successMessage, skipRefetch }: { successMessage?: string; skipRefetch?: boolean } = {},
  ) => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    try {
      const result = await action(assertDefined(accessToken));
      if (!result.success) throw new Error(result.message || "Action failed");
      if (!skipRefetch) {
        await queryClient.invalidateQueries({ queryKey: ["sale", saleId] });
        queryClient.invalidateQueries({ queryKey: ["sales"] });
        queryClient.invalidateQueries({ queryKey: ["analytics"] });
      }
      if (successMessage) Alert.alert(successMessage);
      return true;
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Action failed");
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return { isBusy, run, accessToken };
};
