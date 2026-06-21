import { SaleDetailModal } from "@/components/dashboard/sale-detail-modal";
import { CustomerDetail, SaleDetail } from "@/components/dashboard/use-sales-analytics";
import { fireEvent, screen } from "@testing-library/react-native";
import { act } from "react";
import { Alert, Switch } from "react-native";
import { renderWithQueryClient } from "../../render-with-query-client";

jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ accessToken: "test-token" }),
}));

const mockRun = jest.fn().mockResolvedValue(true);
const mockUpdateSale = jest.fn();
const mockChangeCanContact = jest.fn();
const mockRevokeAccess = jest.fn();
const mockUpdateLicense = jest.fn();

jest.mock("@/components/dashboard/use-sale-actions", () => ({
  saleActions: {
    updateSale: (...args: unknown[]) => mockUpdateSale(...args),
    changeCanContact: (...args: unknown[]) => mockChangeCanContact(...args),
    revokeAccess: (...args: unknown[]) => mockRevokeAccess(...args),
    updateLicense: (...args: unknown[]) => mockUpdateLicense(...args),
  },
  useSaleAction: () => ({ isBusy: false, run: mockRun, accessToken: "test-token" }),
  useMissedPosts: () => ({ data: [] }),
  useSaleOptions: () => ({ data: [], isLoading: false }),
}));

let mockSaleData: { purchase: SaleDetail; customer: CustomerDetail; product_purchases: CustomerDetail[] } | undefined;
jest.mock("@/components/dashboard/use-sales-analytics", () => ({
  ...jest.requireActual("@/components/dashboard/use-sales-analytics"),
  useSaleDetail: () => ({ data: mockSaleData, isLoading: false }),
}));

jest.mock("@/components/dashboard/refund-form", () => ({
  RefundForm: () => null,
}));

const makeSale = (): SaleDetail => ({
  id: "sale-1",
  purchase_id: "purchase-1",
  order_id: 1,
  name: "Test Product",
  purchase_email: "buyer@test.com",
  full_name: "Test Buyer",
  refunded: false,
  partially_refunded: false,
  chargedback: false,
  quantity: 1,
  currency_symbol: "$",
  amount_refundable_in_currency: "10.00",
  refund_fee_notice_shown: true,
  in_app_purchase_platform: null,
  product_rating: null,
});

const makeCustomer = (overrides: Partial<CustomerDetail> = {}): CustomerDetail => ({
  id: "purchase-1",
  email: "buyer@test.com",
  giftee_email: null,
  name: "Test Buyer",
  physical: null,
  shipping: null,
  is_bundle_purchase: false,
  is_existing_user: false,
  can_contact: true,
  product: { name: "Test Product", permalink: "test", native_type: "digital" },
  created_at: "2024-01-01T00:00:00Z",
  price: {
    cents: 1000,
    cents_before_offer_code: 1000,
    cents_refundable: 1000,
    currency_type: "usd",
    recurrence: null,
    tip_cents: null,
  },
  quantity: 1,
  discount: null,
  upsell: null,
  subscription: null,
  is_multiseat_license: false,
  referrer: null,
  is_additional_contribution: false,
  ppp: null,
  is_preorder: false,
  affiliate: null,
  license: null,
  review: null,
  call: null,
  commission: null,
  custom_fields: [],
  transaction_url_for_seller: null,
  is_access_revoked: false,
  refunded: false,
  partially_refunded: false,
  chargedback: false,
  has_options: false,
  option: null,
  utm_link: null,
  download_count: null,
  ...overrides,
});

describe("SaleDetailModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRun.mockResolvedValue(true);
    mockSaleData = { purchase: makeSale(), customer: makeCustomer(), product_purchases: [] };
  });

  it("opens a cross-platform prompt modal (not Alert.prompt) when editing the email", () => {
    renderWithQueryClient(<SaleDetailModal saleId="purchase-1" onClose={jest.fn()} />);
    fireEvent.press(screen.getByText("Edit"));
    expect(screen.getByText("New email for this customer")).toBeTruthy();
    expect(screen.getByDisplayValue("buyer@test.com")).toBeTruthy();
  });

  it("submits the prompt value through the action on Save", async () => {
    renderWithQueryClient(<SaleDetailModal saleId="purchase-1" onClose={jest.fn()} />);
    fireEvent.press(screen.getByText("Edit"));
    fireEvent.changeText(screen.getByDisplayValue("buyer@test.com"), "new@test.com");
    await act(async () => {
      fireEvent.press(screen.getByText("Save"));
      await Promise.resolve();
    });
    expect(mockRun).toHaveBeenCalled();
    const actionFn = mockRun.mock.calls[0][0] as (token: string) => void;
    actionFn("test-token");
    expect(mockUpdateSale).toHaveBeenCalledWith("purchase-1", { email: "new@test.com" }, "test-token");
  });

  it("optimistically toggles the Receives emails switch and runs the action", () => {
    renderWithQueryClient(<SaleDetailModal saleId="purchase-1" onClose={jest.fn()} />);
    const toggle = screen.UNSAFE_getByType(Switch);
    expect(toggle.props.value).toBe(true);
    fireEvent(toggle, "valueChange", false);
    expect(toggle.props.value).toBe(false);
    expect(mockRun).toHaveBeenCalled();
  });

  it("confirms before revoking access", () => {
    const alertSpy = jest.spyOn(Alert, "alert");
    mockSaleData = { purchase: makeSale(), customer: makeCustomer({ is_access_revoked: false }), product_purchases: [] };
    renderWithQueryClient(<SaleDetailModal saleId="purchase-1" onClose={jest.fn()} />);
    fireEvent.press(screen.getByText("Revoke access"));
    expect(alertSpy).toHaveBeenCalledWith("Revoke access", expect.any(String), expect.any(Array));
    const buttons = alertSpy.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    buttons.find((b) => b.text === "Revoke access")?.onPress?.();
    expect(mockRun).toHaveBeenCalled();
  });

  it("confirms before disabling a license", () => {
    const alertSpy = jest.spyOn(Alert, "alert");
    mockSaleData = {
      purchase: makeSale(),
      customer: makeCustomer({ license: { id: "lic-1", key: "ABC", enabled: true, uses: 0 } }),
      product_purchases: [],
    };
    renderWithQueryClient(<SaleDetailModal saleId="purchase-1" onClose={jest.fn()} />);
    fireEvent.press(screen.getByText("Disable license"));
    expect(alertSpy).toHaveBeenCalledWith("Disable license", expect.any(String), expect.any(Array));
  });
});
