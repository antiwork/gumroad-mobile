import { buildPurchaseSearchPath } from "@/components/dashboard/use-purchase-search";

describe("buildPurchaseSearchPath", () => {
  it("uses the selected capped range for searches", () => {
    expect(buildPurchaseSearchPath("year", "2026-05-18T12:00:00.000Z", "buyer@example.com")).toBe(
      "mobile/analytics/data_by_date.json?range=year&end_time=2026-05-18T12%3A00%3A00.000Z&query=buyer%40example.com",
    );
  });
});
