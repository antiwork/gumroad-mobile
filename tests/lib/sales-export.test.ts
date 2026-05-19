import { getExportAllSalesUrl } from "@/lib/sales-export";

describe("getExportAllSalesUrl", () => {
  it("points to the authenticated web sales export", () => {
    expect(getExportAllSalesUrl("test-access-token")).toBe(
      "https://example.com/purchases/export?access_token=test-access-token&mobile_token=test-mobile-token",
    );
  });

  it("points to the web sales export without auth params when the token is missing", () => {
    expect(getExportAllSalesUrl()).toBe("https://example.com/purchases/export");
  });
});
