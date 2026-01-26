import { useAPIRequest } from "@/lib/request";

export type AnalyticsTimeRange = "1w" | "1m" | "1y" | "all";

export interface AnalyticsByDateResponse {
  success: boolean;
  dates: string[];
  by_date: {
    totals: Record<string, Record<string, number>>;
    sales: Record<string, Record<string, number>>;
    views: Record<string, Record<string, number>>;
  };
}

export interface ProcessedDateData {
  dates: string[];
  totals: number[];
  sales: number[];
  views: number[];
}

const getGroupBy = (range: AnalyticsTimeRange): string => {
  return range === "1w" || range === "1m" ? "day" : "month";
};

const processDateData = (data: AnalyticsByDateResponse | undefined): ProcessedDateData => {
  if (!data) {
    return { dates: [], totals: [], sales: [], views: [] };
  }

  const { dates, by_date } = data;

  const totals = dates.map((date) => {
    const dateData = by_date.totals[date] || {};
    return Object.values(dateData).reduce((sum, val) => sum + val, 0);
  });

  const sales = dates.map((date) => {
    const dateData = by_date.sales[date] || {};
    return Object.values(dateData).reduce((sum, val) => sum + val, 0);
  });

  const views = dates.map((date) => {
    const dateData = by_date.views[date] || {};
    return Object.values(dateData).reduce((sum, val) => sum + val, 0);
  });

  return { dates, totals, sales, views };
};

export const useAnalyticsByDate = (timeRange: AnalyticsTimeRange) => {
  const groupBy = getGroupBy(timeRange);

  const query = useAPIRequest<AnalyticsByDateResponse>({
    queryKey: ["analytics-by-date", timeRange],
    url: `mobile/analytics/by_date.json?date_range=${timeRange}&group_by=${groupBy}`,
  });

  const processedData = processDateData(query.data);

  return {
    ...query,
    processedData,
  };
};
