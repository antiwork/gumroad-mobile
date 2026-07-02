import { requestAPI, useAPIRequest } from "@/lib/request";
import { useState } from "react";

export type TimeRange = "day" | "month" | "year" | "all";

export interface SalePurchase {
  id: string;
  product_name: string;
  product_thumbnail_url: string | null;
  formatted_total_price: string;
  email: string;
  timestamp: string;
  refunded: boolean;
  partially_refunded: boolean;
  chargedback: boolean;
}

interface AnalyticsResponse {
  success: boolean;
  formatted_revenue: string;
  sales_count: number;
  purchases: SalePurchase[];
}

export const buildSalesAnalyticsPath = (timeRange: TimeRange, endTime: string) =>
  `mobile/analytics/data_by_date.json?range=${timeRange}&end_time=${encodeURIComponent(endTime)}`;

export const useSalesAnalytics = () => {
  const [timeRange, setTimeRange] = useState<TimeRange>("day");
  const endTime = new Date().toISOString();

  const query = useAPIRequest<AnalyticsResponse>({
    queryKey: ["analytics", timeRange],
    url: buildSalesAnalyticsPath(timeRange, endTime),
  });

  return {
    ...query,
    timeRange,
    setTimeRange,
  };
};

export interface SaleDetail {
  id: string;
  purchase_id: string;
  order_id: number;
  name: string;
  purchase_email: string;
  full_name: string | null;
  refunded: boolean;
  partially_refunded: boolean;
  chargedback: boolean;
  quantity: number;
  currency_symbol: string;
  amount_refundable_in_currency: string;
  refund_fee_notice_shown: boolean;
  in_app_purchase_platform: "apple" | "google" | null;
  product_rating: number | null;
  formatted_total_price?: string;
  purchase_daystamp?: string;
  referrer?: string | null;
  giftee_email?: string | null;
  can_contact?: boolean;
  variants?: Record<string, { title: string; selected_variant: { id: string; name: string } }>;
  offer_code?: { code: string; displayed_amount_off: string | null };
  subscription_data?: {
    id: string;
    subscribed_at: string | null;
    ended_at: string | null;
    ended_reason: string | null;
    status?: string;
  };
  license?: { key: string; uses: number; enabled: boolean };
  review?: { rating: number; message: string | null };
  shipped?: boolean;
  tracking_url?: string | null;
  shipping_address?: {
    full_name: string;
    street_address: string;
    city: string;
    state: string;
    zip_code: string;
    country: string;
  };
}

interface CustomerFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  key: string;
}

export interface CustomerDetail {
  id: string;
  email: string;
  giftee_email: string | null;
  name: string;
  physical: { sku: string; order_number: string } | null;
  shipping: {
    address: {
      full_name: string;
      street_address: string;
      country: string;
      state: string;
      zip_code: string;
      city: string;
    };
    price: string;
    tracking: { shipped: boolean; url?: string | null };
  } | null;
  is_bundle_purchase: boolean;
  is_existing_user: boolean;
  can_contact: boolean;
  product: { name: string; permalink: string; native_type: string };
  created_at: string;
  price: {
    cents: number;
    cents_before_offer_code: number;
    cents_refundable: number;
    currency_type: string;
    recurrence: string | null;
    tip_cents: number | null;
  };
  quantity: number;
  discount: { type: "fixed"; cents: number; code: string } | { type: "percent"; percents: number; code: string } | null;
  upsell: string | null;
  subscription: {
    id: string;
    status: string | null;
    is_installment_plan: boolean;
    remaining_charges: number | null;
  } | null;
  is_multiseat_license: boolean;
  referrer: string | null;
  is_additional_contribution: boolean;
  ppp: { country: string | null; discount: string } | null;
  is_preorder: boolean;
  affiliate: { email: string; amount: string; type: string } | null;
  license: { id: string; key: string; enabled: boolean; uses: number } | null;
  review: {
    rating: number;
    message: string | null;
    response: { message: string } | null;
    videos: {
      id: string;
      approval_status: "pending_review" | "approved" | "rejected";
      thumbnail_url: string | null;
      can_approve: boolean;
      can_reject: boolean;
    }[];
  } | null;
  call: { id: string; call_url: string | null; start_time: string; end_time: string } | null;
  commission: { id: string; files: CustomerFile[]; status: string } | null;
  custom_fields: (
    | { attribute: string; type: "text"; value: string }
    | { attribute: string; type: "file"; files: CustomerFile[] }
  )[];
  transaction_url_for_seller: string | null;
  is_access_revoked: boolean | null;
  refunded: boolean;
  partially_refunded: boolean;
  chargedback: boolean;
  has_options: boolean;
  option: { id: string; name: string } | null;
  utm_link: {
    title: string;
    utm_url: string;
    source: string | null;
    medium: string | null;
    campaign: string | null;
    term: string | null;
    content: string | null;
  } | null;
  download_count: number | null;
}

export interface SaleCharge {
  id: string;
  created_at: string;
  partially_refunded: boolean;
  refunded: boolean;
  chargedback: boolean;
  amount_refundable: string;
  currency_type: string;
  is_upgrade_purchase: boolean;
}

export interface SaleEmail {
  type: "receipt" | "post";
  name: string;
  id: string;
  state: string;
  state_at: string;
  date: string | null;
  url?: string;
}

interface SaleDetailResponse {
  success: boolean;
  purchase: SaleDetail;
  customer: CustomerDetail;
  charges: SaleCharge[];
  emails: SaleEmail[];
  product_purchases: CustomerDetail[];
  can_ping: boolean;
}

export const useSaleDetail = (saleId: string | null) =>
  useAPIRequest<SaleDetailResponse>({
    queryKey: ["sale", saleId],
    url: `mobile/sales/${saleId}.json`,
    enabled: !!saleId,
  });

interface RefundResponse {
  success: boolean;
  message: string;
}

export const refundSale = async ({
  purchaseId,
  amount,
  accessToken,
}: {
  purchaseId: string;
  amount?: string;
  accessToken: string;
}): Promise<RefundResponse> => {
  const data: { amount?: string } = {};
  if (amount) {
    data.amount = amount;
  }
  return requestAPI<RefundResponse>(`mobile/sales/${purchaseId}/refund`, {
    method: "PATCH",
    data,
    accessToken,
  });
};
