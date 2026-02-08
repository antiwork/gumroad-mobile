import {
  formatReferrerName,
  aggregateByReferrer,
  processReferralData,
  REFERRER_COLORS,
  AnalyticsByReferralResponse,
} from "@/components/analytics/use-analytics-by-referral";

describe("formatReferrerName", () => {
  it('maps "direct" to "Direct, email, IM"', () => {
    expect(formatReferrerName("direct")).toBe("Direct, email, IM");
  });

  it('maps "" to "Direct, email, IM"', () => {
    expect(formatReferrerName("")).toBe("Direct, email, IM");
  });

  it("passes through other names unchanged", () => {
    expect(formatReferrerName("google.com")).toBe("google.com");
    expect(formatReferrerName("twitter.com")).toBe("twitter.com");
  });
});

describe("aggregateByReferrer", () => {
  it("flattens nested product->referrer data", () => {
    const data = {
      product1: {
        "google.com": [10, 20],
        "twitter.com": [5, 15],
      },
      product2: {
        "google.com": [3, 7],
      },
    };

    const result = aggregateByReferrer(data, 2);
    expect(result["google.com"]).toEqual([13, 27]);
    expect(result["twitter.com"]).toEqual([5, 15]);
  });

  it('merges "direct" and "" referrers into "Direct, email, IM"', () => {
    const data = {
      product1: {
        direct: [10, 20],
        "": [5, 15],
      },
    };

    const result = aggregateByReferrer(data, 2);
    expect(result["Direct, email, IM"]).toEqual([15, 35]);
    expect(result["direct"]).toBeUndefined();
    expect(result[""]).toBeUndefined();
  });

  it("returns empty object for empty input", () => {
    expect(aggregateByReferrer({}, 3)).toEqual({});
  });
});

describe("processReferralData", () => {
  it("returns empty state for undefined input", () => {
    const result = processReferralData(undefined);
    expect(result.dates).toEqual([]);
    expect(result.revenue.data).toEqual([]);
    expect(result.revenue.topReferrers).toEqual([]);
    expect(result.visits.data).toEqual([]);
    expect(result.sales.data).toEqual([]);
  });

  it("picks top 3 referrers and groups the rest as Other", () => {
    const response: AnalyticsByReferralResponse = {
      success: true,
      dates: ["2024-01-01"],
      by_referral: {
        totals: {
          product1: {
            "google.com": [100],
            "twitter.com": [80],
            "facebook.com": [60],
            "reddit.com": [40],
            "bing.com": [20],
          },
        },
        sales: {
          product1: {
            "google.com": [10],
            "twitter.com": [8],
            "facebook.com": [6],
            "reddit.com": [4],
            "bing.com": [2],
          },
        },
        views: {
          product1: {
            "google.com": [1000],
            "twitter.com": [800],
            "facebook.com": [600],
            "reddit.com": [400],
            "bing.com": [200],
          },
        },
      },
    };

    const result = processReferralData(response);

    expect(result.revenue.topReferrers).toEqual([
      "google.com",
      "twitter.com",
      "facebook.com",
      "Other",
    ]);

    const revenueDay = result.revenue.data[0];
    expect(revenueDay.referrers).toHaveLength(4);
    expect(revenueDay.referrers[0]).toEqual({
      name: "google.com",
      value: 100,
      color: REFERRER_COLORS[0],
    });
    expect(revenueDay.referrers[3]).toEqual({
      name: "Other",
      value: 60,
      color: REFERRER_COLORS[3],
    });
  });

  it("handles 3 or fewer referrers without Other", () => {
    const response: AnalyticsByReferralResponse = {
      success: true,
      dates: ["2024-01-01"],
      by_referral: {
        totals: {
          product1: {
            "google.com": [100],
            "twitter.com": [50],
          },
        },
        sales: {
          product1: {
            "google.com": [10],
            "twitter.com": [5],
          },
        },
        views: {
          product1: {
            "google.com": [1000],
            "twitter.com": [500],
          },
        },
      },
    };

    const result = processReferralData(response);

    expect(result.revenue.topReferrers).toEqual(["google.com", "twitter.com"]);
    expect(result.revenue.data[0].referrers).toHaveLength(2);
    expect(
      result.revenue.data[0].referrers.find((r) => r.name === "Other"),
    ).toBeUndefined();
  });

  it("assigns correct colors to referrers", () => {
    const response: AnalyticsByReferralResponse = {
      success: true,
      dates: ["2024-01-01"],
      by_referral: {
        totals: {
          product1: {
            a: [30],
            b: [20],
            c: [10],
          },
        },
        sales: { product1: { a: [3], b: [2], c: [1] } },
        views: { product1: { a: [300], b: [200], c: [100] } },
      },
    };

    const result = processReferralData(response);
    const referrers = result.revenue.data[0].referrers;
    expect(referrers[0].color).toBe(REFERRER_COLORS[0]);
    expect(referrers[1].color).toBe(REFERRER_COLORS[1]);
    expect(referrers[2].color).toBe(REFERRER_COLORS[2]);
  });
});
