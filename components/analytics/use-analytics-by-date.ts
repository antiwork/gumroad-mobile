import { useAPIRequest } from "@/lib/request";

export type AnalyticsTimeRange = "1w" | "1m" | "1y" | "all";

export interface AnalyticsByDateResponse {
  success: boolean;
  dates: string[];
  by_date: {
    totals: Record<string, number[]>;
    sales: Record<string, number[]>;
    views: Record<string, number[]>;
  };
}

export interface ProcessedDateData {
  dates: string[];
  totals: number[];
  sales: number[];
  views: number[];
}

export const getGroupBy = (range: AnalyticsTimeRange): string => (range === "1w" || range === "1m" ? "day" : "month");

export const sumByDateIndex = (dataByProduct: Record<string, number[]>, dateCount: number): number[] => {
  const productArrays = Object.values(dataByProduct);
  return Array.from({ length: dateCount }, (_, index) =>
    productArrays.reduce((sum, arr) => sum + (arr[index] ?? 0), 0),
  );
};

export const processDateData = (data: AnalyticsByDateResponse | undefined): ProcessedDateData => {
  if (!data) {
    return { dates: [], totals: [], sales: [], views: [] };
  }

  const { dates, by_date } = data;
  const dateCount = dates.length;

  return {
    dates,
    totals: sumByDateIndex(by_date.totals, dateCount),
    sales: sumByDateIndex(by_date.sales, dateCount),
    views: sumByDateIndex(by_date.views, dateCount),
  };
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
