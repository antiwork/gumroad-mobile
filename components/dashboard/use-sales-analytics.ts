import { assertDefined } from "@/lib/assert";
import { useAuth } from "@/lib/auth-context";
import { requestAPI, UnauthorizedError } from "@/lib/request";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

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
  const { isLoading: isAuthLoading, accessToken, logout } = useAuth();
  const [timeRange, setTimeRange] = useState<TimeRange>("day");

  const query = useQuery({
    queryKey: ["analytics", timeRange],
    queryFn: async () => {
      const endTime = new Date().toISOString();
      const response = await requestAPI<AnalyticsResponse>(
        `mobile/analytics/data_by_date.json?range=${timeRange}&end_time=${encodeURIComponent(endTime)}`,
        { accessToken: assertDefined(accessToken) },
      );
      return response;
    },
    enabled: !!accessToken,
  });

  useEffect(() => {
    if ((!isAuthLoading && !accessToken) || query.error instanceof UnauthorizedError) logout();
  }, [isAuthLoading, accessToken, query.error, logout]);

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
  const { accessToken, logout, isLoading: isAuthLoading } = useAuth();

  const query = useQuery({
    queryKey: ["sale", saleId],
    queryFn: async () => {
      const response = await requestAPI<SaleDetailResponse>(`mobile/sales/${saleId}.json`, {
        accessToken: assertDefined(accessToken),
      });
      return response.purchase;
    },
    enabled: !!accessToken && !!saleId,
  });

  useEffect(() => {
    if ((!isAuthLoading && !accessToken) || query.error instanceof UnauthorizedError) logout();
  }, [isAuthLoading, accessToken, query.error, logout]);

  return query;
};
