import { requestAPI, useAPIRequest } from "@/lib/request";
import { useState } from "react";

export type TimeRange = "day" | "month" | "all";

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

export const useSalesAnalytics = () => {
  const [timeRange, setTimeRange] = useState<TimeRange>("day");
  const endTime = new Date().toISOString();

  const query = useAPIRequest<AnalyticsResponse>({
    queryKey: ["analytics", timeRange],
    url: `mobile/analytics/data_by_date.json?range=${timeRange}&end_time=${encodeURIComponent(endTime)}`,
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
  formatted_price: string;
  purchase_email: string;
  full_name: string | null;
  timestamp: string;
  formatted_timestamp: string;
  refunded: boolean;
  partially_refunded: boolean;
  chargedback: boolean;
  ip_country: string | null;
  referrer: string | null;
  quantity: number;
  variants: string | null;
  offer_code: string | null;
  currency_symbol: string;
  amount_refundable_in_currency: string;
  refund_fee_notice_shown: boolean;
  in_app_purchase_platform: "apple" | "google" | null;
}

interface SaleDetailResponse {
  success: boolean;
  purchase: SaleDetail;
}

export const useSaleDetail = (saleId: string | null) => {
  return useAPIRequest<SaleDetailResponse, SaleDetail>({
    queryKey: ["sale", saleId],
    url: `mobile/sales/${saleId}.json`,
    enabled: !!saleId,
    select: (data) => data.purchase,
  });
};

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
