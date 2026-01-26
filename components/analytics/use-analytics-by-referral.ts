import { useAPIRequest } from "@/lib/request";
import { AnalyticsTimeRange } from "./use-analytics-by-date";

export interface AnalyticsByReferralResponse {
  success: boolean;
  dates: string[];
  by_referral: {
    totals: Record<string, Record<string, number>>;
    sales: Record<string, Record<string, number>>;
    views: Record<string, Record<string, number>>;
  };
}

export interface ReferrerData {
  name: string;
  value: number;
  color: string;
}

export interface ProcessedReferralData {
  dates: string[];
  revenue: { date: string; referrers: ReferrerData[] }[];
  visits: { date: string; referrers: ReferrerData[] }[];
  sales: { date: string; referrers: ReferrerData[] }[];
  topReferrers: string[];
}

const REFERRER_COLORS = ["#8a8a8a", "#23a094", "#dc341e", "#f1c40f"];

const formatReferrerName = (name: string): string => {
  if (name === "direct" || name === "") {
    return "Direct, email, IM";
  }
  return name;
};

const getGroupBy = (range: AnalyticsTimeRange): string => {
  return range === "1w" || range === "1m" ? "day" : "month";
};

const processReferralData = (data: AnalyticsByReferralResponse | undefined): ProcessedReferralData => {
  if (!data) {
    return { dates: [], revenue: [], visits: [], sales: [], topReferrers: [] };
  }

  const { dates, by_referral } = data;

  const referrerTotals: Record<string, number> = {};
  dates.forEach((date) => {
    const dateData = by_referral.totals[date] || {};
    Object.entries(dateData).forEach(([referrer, value]) => {
      const formattedName = formatReferrerName(referrer);
      referrerTotals[formattedName] = (referrerTotals[formattedName] || 0) + value;
    });
  });

  const sortedReferrers = Object.entries(referrerTotals)
    .sort(([, a], [, b]) => b - a)
    .map(([name]) => name);

  const topReferrers = sortedReferrers.slice(0, 3);
  const hasOther = sortedReferrers.length > 3;

  const processMetric = (
    metricData: Record<string, Record<string, number>>,
  ): { date: string; referrers: ReferrerData[] }[] => {
    return dates.map((date) => {
      const dateData = metricData[date] || {};
      const referrerValues: Record<string, number> = {};

      Object.entries(dateData).forEach(([referrer, value]) => {
        const formattedName = formatReferrerName(referrer);
        if (topReferrers.includes(formattedName)) {
          referrerValues[formattedName] = (referrerValues[formattedName] || 0) + value;
        } else {
          referrerValues["Other"] = (referrerValues["Other"] || 0) + value;
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
  };

  return {
    dates,
    revenue: processMetric(by_referral.totals),
    visits: processMetric(by_referral.views),
    sales: processMetric(by_referral.sales),
    topReferrers: hasOther ? [...topReferrers, "Other"] : topReferrers,
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
