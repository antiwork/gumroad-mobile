export type RawProduct = {
  id?: string | null;
  name?: string | null;
  description?: string | null;
  price?: number | string | null;
  currency?: string | null;
  formatted_price?: string | null;
  thumbnail_url?: string | null;
  published?: boolean | null;
  tags?: string[] | null;
  custom_summary?: string | null;
  deleted?: boolean | null;
  sales_count?: number | string | null;
  short_url?: string | null;
  customizable_price?: boolean | null;
  unique_permalink?: string | null;
  custom_permalink?: string | null;
};

export type ProductModel = {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  formattedPrice: string;
  thumbnailUrl: string | null;
  published: boolean;
  tags: string[];
  customSummary: string;
  deleted: boolean;
  salesCount: number;
  shortUrl: string | null;
  customizablePrice: boolean;
  uniquePermalink: string | null;
  customPermalink: string | null;
};

const toNumber = (value: number | string | null | undefined): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

export const normalizeProduct = (raw: RawProduct): ProductModel | null => {
  const id = raw.id?.trim();
  if (!id) return null;

  const name = raw.name?.trim() || "Untitled product";
  const price = toNumber(raw.price);
  const currency = (raw.currency || "usd").toLowerCase();
  const formattedPrice =
    raw.formatted_price?.trim() ||
    new Intl.NumberFormat(undefined, { style: "currency", currency: currency.toUpperCase(), maximumFractionDigits: 2 }).format(
      price / 100,
    );

  return {
    id,
    name,
    description: raw.description || "",
    price,
    currency,
    formattedPrice,
    thumbnailUrl: raw.thumbnail_url || null,
    published: !!raw.published,
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    customSummary: raw.custom_summary || "",
    deleted: !!raw.deleted,
    salesCount: toNumber(raw.sales_count),
    shortUrl: raw.short_url || null,
    customizablePrice: !!raw.customizable_price,
    uniquePermalink: raw.unique_permalink || null,
    customPermalink: raw.custom_permalink || null,
  };
};

export const normalizeProducts = (rawProducts: RawProduct[] | null | undefined): ProductModel[] =>
  (rawProducts || []).map(normalizeProduct).filter((product): product is ProductModel => !!product && !product.deleted);
