import { buildSalesAnalyticsPath } from "@/components/dashboard/use-sales-analytics";

describe("buildSalesAnalyticsPath", () => {
  it("uses the capped year range", () => {
    expect(buildSalesAnalyticsPath("year", "2026-05-18T12:00:00.000Z")).toBe(
      "mobile/analytics/data_by_date.json?range=year&end_time=2026-05-18T12%3A00%3A00.000Z",
    );
  });
});
