import { ProductCard } from "@/components/products/product-card";
import { StatCard } from "@/components/products/stat-card";
import { StatusFilterBar } from "@/components/products/status-filter-bar";
import { ProductModel } from "@/lib/product-api";
import { fireEvent, render, screen } from "@testing-library/react-native";

const makeProduct = (overrides: Partial<ProductModel> = {}): ProductModel => ({
  id: "prod-1",
  name: "My Product",
  description: "A cool product",
  price: 1000,
  currency: "usd",
  nativeType: "digital",
  subscriptionDuration: null,
  formattedPrice: "$10.00",
  thumbnailUrl: null,
  published: true,
  tags: [],
  customSummary: "",
  deleted: false,
  salesCount: 3,
  salesUsdCents: 3000,
  shortUrl: "https://example.gumroad.com/l/prod-1",
  customizablePrice: false,
  uniquePermalink: "prod-1",
  customPermalink: null,
  ...overrides,
});

describe("ProductCard", () => {
  it("renders product name", () => {
    render(<ProductCard product={makeProduct()} onPress={jest.fn()} isFirst={false} />);
    expect(screen.getByText("My Product")).toBeTruthy();
  });

  it("shows Published badge when product is published", () => {
    render(<ProductCard product={makeProduct({ published: true })} onPress={jest.fn()} isFirst={false} />);
    expect(screen.getByText("Published")).toBeTruthy();
  });

  it("shows Draft badge when product is unpublished", () => {
    render(<ProductCard product={makeProduct({ published: false })} onPress={jest.fn()} isFirst={false} />);
    expect(screen.getByText("Draft")).toBeTruthy();
  });

  it("shows PWYW badge for customizable price products", () => {
    render(<ProductCard product={makeProduct({ customizablePrice: true })} onPress={jest.fn()} isFirst={false} />);
    expect(screen.getByText("PWYW")).toBeTruthy();
  });

  it("does not show PWYW badge for fixed price products", () => {
    render(<ProductCard product={makeProduct({ customizablePrice: false })} onPress={jest.fn()} isFirst={false} />);
    expect(screen.queryByText("PWYW")).toBeNull();
  });

  it("shows sales count", () => {
    render(<ProductCard product={makeProduct({ salesCount: 42 })} onPress={jest.fn()} isFirst={false} />);
    expect(screen.getByText("42 sales")).toBeTruthy();
  });

  it("shows formatted price", () => {
    render(<ProductCard product={makeProduct({ formattedPrice: "€25.00" })} onPress={jest.fn()} isFirst={false} />);
    expect(screen.getByText("€25.00")).toBeTruthy();
  });

  it("shows short URL when present", () => {
    render(<ProductCard product={makeProduct()} onPress={jest.fn()} isFirst={false} />);
    expect(screen.getByText("https://example.gumroad.com/l/prod-1")).toBeTruthy();
  });

  it("does not show short URL when absent", () => {
    render(<ProductCard product={makeProduct({ shortUrl: null })} onPress={jest.fn()} isFirst={false} />);
    expect(screen.queryByText(/gumroad\.com/)).toBeNull();
  });

  it("shows custom summary when present", () => {
    render(<ProductCard product={makeProduct({ customSummary: "Great summary" })} onPress={jest.fn()} isFirst={false} />);
    expect(screen.getByText("Great summary")).toBeTruthy();
  });

  it("falls back to description when no custom summary", () => {
    render(<ProductCard product={makeProduct({ customSummary: "", description: "A description" })} onPress={jest.fn()} isFirst={false} />);
    expect(screen.getByText("A description")).toBeTruthy();
  });

  it("shows up to 2 tags joined by bullet", () => {
    render(<ProductCard product={makeProduct({ tags: ["design", "tools", "extra"] })} onPress={jest.fn()} isFirst={false} />);
    expect(screen.getByText("design • tools")).toBeTruthy();
  });

  it("calls onPress when tapped", () => {
    const onPress = jest.fn();
    render(<ProductCard product={makeProduct()} onPress={onPress} isFirst={false} />);
    fireEvent.press(screen.getByTestId("product-card-prod-1"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe("StatCard", () => {
  it("renders label and value", () => {
    render(<StatCard label="Revenue" value="$1,234.00" />);
    expect(screen.getByText("Revenue")).toBeTruthy();
    expect(screen.getByText("$1,234.00")).toBeTruthy();
  });

  it("applies testID when provided", () => {
    render(<StatCard label="Sales" value="99" testID="sales-stat" />);
    expect(screen.getByTestId("sales-stat")).toBeTruthy();
  });
});

describe("StatusFilterBar", () => {
  it("renders all three filter buttons", () => {
    render(<StatusFilterBar value="all" onChange={jest.fn()} />);
    expect(screen.getByText("All")).toBeTruthy();
    expect(screen.getByText("Published")).toBeTruthy();
    expect(screen.getByText("Drafts")).toBeTruthy();
  });

  it("calls onChange with 'published' when Published is pressed", () => {
    const onChange = jest.fn();
    render(<StatusFilterBar value="all" onChange={onChange} />);
    fireEvent.press(screen.getByTestId("status-filter-published"));
    expect(onChange).toHaveBeenCalledWith("published");
  });

  it("calls onChange with 'draft' when Drafts is pressed", () => {
    const onChange = jest.fn();
    render(<StatusFilterBar value="all" onChange={onChange} />);
    fireEvent.press(screen.getByTestId("status-filter-draft"));
    expect(onChange).toHaveBeenCalledWith("draft");
  });

  it("calls onChange with 'all' when All is pressed", () => {
    const onChange = jest.fn();
    render(<StatusFilterBar value="published" onChange={onChange} />);
    fireEvent.press(screen.getByTestId("status-filter-all"));
    expect(onChange).toHaveBeenCalledWith("all");
  });
});
