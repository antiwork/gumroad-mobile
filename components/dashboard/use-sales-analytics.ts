import { useAPIRequest } from "@/lib/request";
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
  order_id: number;
  name: string;
  formatted_price: string;
  purchase_email: string;
  full_name: string | null;
  timestamp: string;
  formatted_timestamp: string;
  is_refunded: boolean;
  is_partially_refunded: boolean;
  is_chargedback: boolean;
  ip_country: string | null;
  referrer: string | null;
  quantity: number;
  variants: string | null;
  offer_code: string | null;
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
