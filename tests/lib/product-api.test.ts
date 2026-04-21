import { normalizeProduct, normalizeProducts, RawProduct } from "@/lib/product-api";

const makeRaw = (overrides: Partial<RawProduct> = {}): RawProduct => ({
  id: "abc123",
  name: "Test Product",
  description: "A description",
  price: 1000,
  currency: "usd",
  native_type: "digital",
  subscription_duration: null,
  formatted_price: "$10.00",
  thumbnail_url: null,
  published: true,
  tags: ["tag1"],
  custom_summary: "Short summary",
  deleted: false,
  sales_count: 5,
  sales_usd_cents: 5000,
  short_url: "https://example.gumroad.com/l/abc",
  customizable_price: false,
  unique_permalink: "abc",
  custom_permalink: "my-product",
  ...overrides,
});

describe("normalizeProduct", () => {
  it("returns null when id is missing", () => {
    expect(normalizeProduct({ ...makeRaw(), id: null })).toBeNull();
    expect(normalizeProduct({ ...makeRaw(), id: "" })).toBeNull();
    expect(normalizeProduct({ ...makeRaw(), id: "   " })).toBeNull();
  });

  it("maps all fields correctly", () => {
    const result = normalizeProduct(makeRaw());
    expect(result).toMatchObject({
      id: "abc123",
      name: "Test Product",
      description: "A description",
      price: 1000,
      currency: "usd",
      nativeType: "digital",
      subscriptionDuration: null,
      formattedPrice: "$10.00",
      thumbnailUrl: null,
      published: true,
      tags: ["tag1"],
      customSummary: "Short summary",
      deleted: false,
      salesCount: 5,
      salesUsdCents: 5000,
      shortUrl: "https://example.gumroad.com/l/abc",
      customizablePrice: false,
      uniquePermalink: "abc",
      customPermalink: "my-product",
    });
  });

  it("uses 'Untitled product' when name is missing", () => {
    expect(normalizeProduct(makeRaw({ name: null }))?.name).toBe("Untitled product");
    expect(normalizeProduct(makeRaw({ name: "   " }))?.name).toBe("Untitled product");
  });

  it("defaults currency to 'usd' when missing", () => {
    expect(normalizeProduct(makeRaw({ currency: null }))?.currency).toBe("usd");
  });

  it("defaults nativeType to 'digital' when missing", () => {
    expect(normalizeProduct(makeRaw({ native_type: null }))?.nativeType).toBe("digital");
  });

  it("formats price from raw when formatted_price is missing", () => {
    const result = normalizeProduct(makeRaw({ formatted_price: null, price: 2500, currency: "usd" }));
    expect(result?.formattedPrice).toContain("25");
  });

  it("handles string price values", () => {
    expect(normalizeProduct(makeRaw({ price: "999" }))?.price).toBe(999);
    expect(normalizeProduct(makeRaw({ price: "invalid" }))?.price).toBe(0);
  });

  it("handles string sales_count and sales_usd_cents", () => {
    const result = normalizeProduct(makeRaw({ sales_count: "12", sales_usd_cents: "9900" }));
    expect(result?.salesCount).toBe(12);
    expect(result?.salesUsdCents).toBe(9900);
  });

  it("coerces non-finite numbers to 0", () => {
    expect(normalizeProduct(makeRaw({ price: NaN }))?.price).toBe(0);
    expect(normalizeProduct(makeRaw({ price: Infinity }))?.price).toBe(0);
  });

  it("defaults tags to empty array when null", () => {
    expect(normalizeProduct(makeRaw({ tags: null }))?.tags).toEqual([]);
  });

  it("returns empty strings for missing text fields", () => {
    const result = normalizeProduct(makeRaw({ description: null, custom_summary: null }));
    expect(result?.description).toBe("");
    expect(result?.customSummary).toBe("");
  });

  it("maps deleted flag correctly", () => {
    expect(normalizeProduct(makeRaw({ deleted: true }))?.deleted).toBe(true);
    expect(normalizeProduct(makeRaw({ deleted: false }))?.deleted).toBe(false);
    expect(normalizeProduct(makeRaw({ deleted: null }))?.deleted).toBe(false);
  });

  it("maps published flag correctly", () => {
    expect(normalizeProduct(makeRaw({ published: true }))?.published).toBe(true);
    expect(normalizeProduct(makeRaw({ published: false }))?.published).toBe(false);
    expect(normalizeProduct(makeRaw({ published: null }))?.published).toBe(false);
  });

  it("passes through null permalink fields", () => {
    const result = normalizeProduct(makeRaw({ unique_permalink: null, custom_permalink: null }));
    expect(result?.uniquePermalink).toBeNull();
    expect(result?.customPermalink).toBeNull();
  });
});

describe("normalizeProducts", () => {
  it("returns empty array for null or undefined input", () => {
    expect(normalizeProducts(null)).toEqual([]);
    expect(normalizeProducts(undefined)).toEqual([]);
  });

  it("filters out deleted products", () => {
    const products = [makeRaw({ id: "1", deleted: false }), makeRaw({ id: "2", deleted: true })];
    expect(normalizeProducts(products).map((p) => p.id)).toEqual(["1"]);
  });

  it("filters out products with missing ids", () => {
    const products = [makeRaw({ id: "1" }), makeRaw({ id: null })];
    expect(normalizeProducts(products)).toHaveLength(1);
  });

  it("normalizes all valid products in the array", () => {
    const products = [makeRaw({ id: "1", name: "A" }), makeRaw({ id: "2", name: "B" })];
    const result = normalizeProducts(products);
    expect(result.map((p) => p.name)).toEqual(["A", "B"]);
  });
});
