import { RefundForm } from "@/components/dashboard/refund-form";
import { SaleDetail } from "@/components/dashboard/use-sales-analytics";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { act } from "react";
import { Alert as NativeAlert } from "react-native";

jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ accessToken: "test-token" }),
}));

jest.mock("expo-linking", () => ({
  openURL: jest.fn(),
}));

const mockRefundSale = jest.fn();
jest.mock("@/components/dashboard/use-sales-analytics", () => ({
  ...jest.requireActual("@/components/dashboard/use-sales-analytics"),
  refundSale: (...args: unknown[]) => mockRefundSale(...args),
}));

const makeSale = (overrides: Partial<SaleDetail> = {}): SaleDetail => ({
  id: "sale-1",
  purchase_id: "purchase-1",
  order_id: 1,
  name: "Test Product",
  formatted_price: "$10.00",
  purchase_email: "buyer@test.com",
  full_name: "Test Buyer",
  timestamp: "2024-01-01T00:00:00Z",
  formatted_timestamp: "Jan 1, 2024",
  refunded: false,
  partially_refunded: false,
  chargedback: false,
  ip_country: "US",
  referrer: null,
  quantity: 1,
  variants: null,
  offer_code: null,
  currency_symbol: "$",
  amount_refundable_in_currency: "10.00",
  refund_fee_notice_shown: true,
  in_app_purchase_platform: null,
  ...overrides,
});

const renderWithProviders = (sale: SaleDetail, onRefundSuccess?: () => void) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <RefundForm sale={sale} onRefundSuccess={onRefundSuccess} />
    </QueryClientProvider>,
  );
};

const pressRefundAndConfirm = () => {
  const alertSpy = jest.spyOn(NativeAlert, "alert");
  fireEvent.press(screen.getByRole("button"));
  const buttons = alertSpy.mock.calls[0][2] as { text: string; onPress?: () => void }[];
  buttons.find((b) => b.text === "Confirm refund")?.onPress?.();
};

describe("RefundForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows platform message instead of form for in-app purchases", () => {
    renderWithProviders(makeSale({ in_app_purchase_platform: "apple" }));
    expect(screen.getByText(/refund from Apple/)).toBeTruthy();
    expect(screen.queryByText("Refund fully")).toBeNull();
  });

  it("shows refunded status for already-refunded sales", () => {
    renderWithProviders(makeSale({ partially_refunded: true }));
    expect(screen.getByText("Partially refunded")).toBeTruthy();
  });

  it("renders nothing when amount refundable is 0", () => {
    const { toJSON } = renderWithProviders(makeSale({ amount_refundable_in_currency: "0" }));
    expect(toJSON()).toBeNull();
  });

  it("renders form with currency symbol and refundable amount placeholder", () => {
    renderWithProviders(makeSale({ currency_symbol: "€", amount_refundable_in_currency: "25.50" }));
    expect(screen.getByText("€")).toBeTruthy();
    expect(screen.getByPlaceholderText("25.50")).toBeTruthy();
    expect(screen.getByText("Refund fully")).toBeTruthy();
  });

  it("switches button text to partial refund when input is less than refundable", () => {
    renderWithProviders(makeSale());
    fireEvent.changeText(screen.getByPlaceholderText("10.00"), "5.00");
    expect(screen.getByText("Issue partial refund")).toBeTruthy();
  });

  it("shows refund fee notice only when not previously shown", () => {
    const { unmount } = renderWithProviders(makeSale({ refund_fee_notice_shown: true }));
    expect(screen.queryByText(/payment processor fees/)).toBeNull();
    unmount();

    renderWithProviders(makeSale({ refund_fee_notice_shown: false }));
    expect(screen.getByText(/payment processor fees/)).toBeTruthy();
  });

  it("shows confirmation alert with correct amount on refund press", () => {
    jest.spyOn(NativeAlert, "alert");
    renderWithProviders(makeSale({ currency_symbol: "€" }));
    fireEvent.changeText(screen.getByPlaceholderText("10.00"), "5.00");
    fireEvent.press(screen.getByText("Issue partial refund"));
    expect(NativeAlert.alert).toHaveBeenCalledWith(
      "Purchase refund",
      "Would you like to confirm this purchase refund of €5.00?",
      expect.any(Array),
    );
  });

  it("calls refundSale and shows success state after confirming", async () => {
    mockRefundSale.mockResolvedValue({ success: true, message: "" });
    const onRefundSuccess = jest.fn();
    renderWithProviders(makeSale(), onRefundSuccess);
    await act(async () => {
      pressRefundAndConfirm();
      await Promise.resolve();
    });
    expect(mockRefundSale).toHaveBeenCalledWith({
      purchaseId: "purchase-1",
      amount: undefined,
      accessToken: "test-token",
    });
    expect(screen.getByText("Refunded")).toBeTruthy();
    expect(onRefundSuccess).toHaveBeenCalled();
  });

  it("shows 'Partially refunded' after confirming a partial amount", async () => {
    mockRefundSale.mockResolvedValue({ success: true, message: "" });
    renderWithProviders(makeSale());
    fireEvent.changeText(screen.getByPlaceholderText("10.00"), "3.00");
    await act(async () => {
      pressRefundAndConfirm();
      await Promise.resolve();
    });
    expect(screen.getByText("Partially refunded")).toBeTruthy();
  });

  it("shows error message on refund failure", async () => {
    mockRefundSale.mockResolvedValue({ success: false, message: "Insufficient funds" });
    renderWithProviders(makeSale());
    await act(async () => {
      pressRefundAndConfirm();
      await Promise.resolve();
    });
    expect(screen.getByText("Insufficient funds")).toBeTruthy();
  });
});
