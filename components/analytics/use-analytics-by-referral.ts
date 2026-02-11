import { useAPIRequest } from "@/lib/request";
import { AnalyticsTimeRange } from "./use-analytics-by-date";

export interface AnalyticsByReferralResponse {
  success: boolean;
  dates: string[];
  by_referral: {
    totals: Record<string, Record<string, number[]>>;
    sales: Record<string, Record<string, number[]>>;
    views: Record<string, Record<string, number[]>>;
  };
}

export interface ReferrerData {
  name: string;
  value: number;
  color: string;
}

export interface MetricData {
  data: { date: string; referrers: ReferrerData[] }[];
  topReferrers: string[];
}

export interface ProcessedReferralData {
  dates: string[];
  revenue: MetricData;
  visits: MetricData;
  sales: MetricData;
}

export const REFERRER_COLORS = ["#8a8a8a", "#23a094", "#dc341e", "#f1c40f"];

export const formatReferrerName = (name: string): string => {
  if (name === "direct" || name === "") {
    return "Direct, email, IM";
  }
  return name;
};

const getGroupBy = (range: AnalyticsTimeRange): string => (range === "1w" || range === "1m" ? "day" : "month");

export const aggregateByReferrer = (
  metricData: Record<string, Record<string, number[]>>,
  dateCount: number,
): Record<string, number[]> => {
  const aggregated: Record<string, number[]> = {};

  Object.values(metricData).forEach((referrerData) => {
    Object.entries(referrerData).forEach(([referrer, values]) => {
      const formattedName = formatReferrerName(referrer);
      if (!aggregated[formattedName]) {
        aggregated[formattedName] = new Array(dateCount).fill(0);
      }
      values.forEach((value, index) => {
        aggregated[formattedName][index] += value;
      });
    });
  });

  return aggregated;
};

export const processReferralData = (data: AnalyticsByReferralResponse | undefined): ProcessedReferralData => {
  if (!data) {
    const emptyMetric = { data: [], topReferrers: [] };
    return { dates: [], revenue: emptyMetric, visits: emptyMetric, sales: emptyMetric };
  }

  const { dates, by_referral } = data;

  const processMetric = (metricData: Record<string, Record<string, number[]>>): MetricData => {
    const aggregated = aggregateByReferrer(metricData, dates.length);

    const referrerTotals: Record<string, number> = {};
    Object.entries(aggregated).forEach(([referrer, values]) => {
      referrerTotals[referrer] = values.reduce((sum, val) => sum + val, 0);
    });

    const sortedReferrers = Object.entries(referrerTotals)
      .sort(([, a], [, b]) => b - a)
      .map(([name]) => name);

    const topReferrers = sortedReferrers.slice(0, 3);
    const hasOther = sortedReferrers.length > 3;

    const chartData = dates.map((date, dateIndex) => {
      const referrerValues: Record<string, number> = {};

      Object.entries(aggregated).forEach(([referrer, values]) => {
        if (topReferrers.includes(referrer)) {
          referrerValues[referrer] = (referrerValues[referrer] || 0) + values[dateIndex];
        } else {
          referrerValues["Other"] = (referrerValues["Other"] || 0) + values[dateIndex];
        }
      });

      const referrers: ReferrerData[] = topReferrers.map((name, index) => ({
        name,
        value: referrerValues[name] || 0,
        color: REFERRER_COLORS[index],
      }));

      if (hasOther) {
        referrers.push({
          name: "Other",
          value: referrerValues["Other"] || 0,
          color: REFERRER_COLORS[3],
        });
      }

      return { date, referrers };
    });

    return {
      data: chartData,
      topReferrers: hasOther ? [...topReferrers, "Other"] : topReferrers,
    };
  };

  return {
    dates,
    revenue: processMetric(by_referral.totals),
    visits: processMetric(by_referral.views),
    sales: processMetric(by_referral.sales),
  };
};

export const useAnalyticsByReferral = (timeRange: AnalyticsTimeRange) => {
  const groupBy = getGroupBy(timeRange);

  const query = useAPIRequest<AnalyticsByReferralResponse>({
    queryKey: ["analytics-by-referral", timeRange],
    url: `mobile/analytics/by_referral.json?date_range=${timeRange}&group_by=${groupBy}`,
  });

  const processedData = processReferralData(query.data);

  return {
    ...query,
    processedData,
  };
};
