import { SaleItem } from "@/components/dashboard/sale-item";
import { SalePurchase } from "@/components/dashboard/use-sales-analytics";
import { render } from "@testing-library/react-native";

jest.mock("@/components/styled", () => {
  const { View } = require("react-native");
  return { StyledImage: (props: Record<string, unknown>) => <View testID="styled-image" {...props} /> };
});

const makeSale = (overrides: Partial<SalePurchase> = {}): SalePurchase => ({
  id: "sale-1",
  product_name: "Test Product",
  formatted_total_price: "$10.00",
  email: "buyer@test.com",
  timestamp: "Jan 1, 2024",
  refunded: false,
  partially_refunded: false,
  chargedback: false,
  product_thumbnail_url: "https://example.com/thumb.gif",
  ...overrides,
});

describe("SaleItem", () => {
  it("renders thumbnail with autoplay disabled", () => {
    const { getByTestId } = render(<SaleItem sale={makeSale()} onPress={jest.fn()} />);
    const image = getByTestId("styled-image");
    expect(image.props.autoplay).toBe(false);
  });

  it("renders placeholder when no thumbnail URL", () => {
    const { queryByTestId, getByText } = render(
      <SaleItem sale={makeSale({ product_thumbnail_url: null })} onPress={jest.fn()} />,
    );
    expect(queryByTestId("styled-image")).toBeNull();
    expect(getByText("📦")).toBeTruthy();
  });
});
