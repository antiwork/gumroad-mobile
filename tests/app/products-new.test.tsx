import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { renderWithQueryClient } from "../render-with-query-client";
import ProductNew from "@/app/products/new";

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack }),
}));

jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ isLoading: false, accessToken: "test-token" }),
}));

const mockRequestAPI = jest.fn();
jest.mock("@/lib/request", () => ({
  requestAPI: (...args: unknown[]) => mockRequestAPI(...args),
}));

jest.mock("@/lib/open-url", () => ({
  safeOpenURL: jest.fn(),
}));

jest.mock("@sentry/react-native", () => ({
  captureException: jest.fn(),
}));

jest.mock("@/lib/env", () => ({
  env: { EXPO_PUBLIC_GUMROAD_URL: "https://example.com" },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe("ProductNew screen", () => {
  it("renders the page heading", () => {
    renderWithQueryClient(<ProductNew />);
    expect(screen.getByText("What are you creating?")).toBeTruthy();
  });

  it("renders all product type options", () => {
    renderWithQueryClient(<ProductNew />);
    expect(screen.getByText("Digital product")).toBeTruthy();
    expect(screen.getByText("Course or tutorial")).toBeTruthy();
    expect(screen.getByText("E-book")).toBeTruthy();
    expect(screen.getByText("Membership")).toBeTruthy();
    expect(screen.getByText("Bundle")).toBeTruthy();
    expect(screen.getByText("Call")).toBeTruthy();
    expect(screen.getByText("Coffee")).toBeTruthy();
  });

  it("renders name and price fields", () => {
    renderWithQueryClient(<ProductNew />);
    expect(screen.getByTestId("product-name-input")).toBeTruthy();
    expect(screen.getByTestId("product-price-input")).toBeTruthy();
  });

  it("shows validation error when name is empty", async () => {
    renderWithQueryClient(<ProductNew />);
    await act(async () => {
      fireEvent.press(screen.getByTestId("create-product-button"));
    });
    expect(screen.getByText("Product name is required.")).toBeTruthy();
  });

  it("shows validation error when price is empty", async () => {
    renderWithQueryClient(<ProductNew />);
    fireEvent.changeText(screen.getByTestId("product-name-input"), "My Product");
    await act(async () => {
      fireEvent.press(screen.getByTestId("create-product-button"));
    });
    expect(screen.getByText("Price is required.")).toBeTruthy();
  });

  it("shows validation error for invalid price", async () => {
    renderWithQueryClient(<ProductNew />);
    fireEvent.changeText(screen.getByTestId("product-name-input"), "My Product");
    fireEvent.changeText(screen.getByTestId("product-price-input"), ".");
    await act(async () => {
      fireEvent.press(screen.getByTestId("create-product-button"));
    });
    expect(screen.getByText("Price must be a valid number.")).toBeTruthy();
  });

  it("calls API with correct payload and navigates to edit screen on success", async () => {
    mockRequestAPI.mockResolvedValueOnce({ success: true, product: { id: "new-prod-123" } });

    renderWithQueryClient(<ProductNew />);
    fireEvent.changeText(screen.getByTestId("product-name-input"), "New Product");
    fireEvent.changeText(screen.getByTestId("product-price-input"), "9.99");

    await act(async () => {
      fireEvent.press(screen.getByTestId("create-product-button"));
    });

    expect(mockRequestAPI).toHaveBeenCalledWith(
      "/v2/products",
      expect.objectContaining({
        method: "POST",
        data: expect.objectContaining({ name: "New Product", price: 999, native_type: "digital" }),
      }),
    );

    expect(mockReplace).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: "/products/[id]", params: { id: "new-prod-123" } }),
    );
  });

  it("sends subscription_duration for membership product type", async () => {
    mockRequestAPI.mockResolvedValueOnce({ success: true, product: { id: "membership-id" } });

    renderWithQueryClient(<ProductNew />);
    fireEvent.press(screen.getByTestId("product-kind-membership"));
    fireEvent.changeText(screen.getByTestId("product-name-input"), "My Membership");
    fireEvent.changeText(screen.getByTestId("product-price-input"), "5.00");

    await act(async () => {
      fireEvent.press(screen.getByTestId("create-product-button"));
    });

    expect(mockRequestAPI).toHaveBeenCalledWith(
      "/v2/products",
      expect.objectContaining({
        data: expect.objectContaining({ native_type: "membership", subscription_duration: "monthly" }),
      }),
    );
  });

  it("shows error banner on API failure", async () => {
    mockRequestAPI.mockRejectedValueOnce(new Error("Server error"));

    renderWithQueryClient(<ProductNew />);
    fireEvent.changeText(screen.getByTestId("product-name-input"), "A Product");
    fireEvent.changeText(screen.getByTestId("product-price-input"), "1.00");

    await act(async () => {
      fireEvent.press(screen.getByTestId("create-product-button"));
    });

    expect(screen.getByText("Server error")).toBeTruthy();
  });

  it("navigates back when Cancel is pressed", () => {
    renderWithQueryClient(<ProductNew />);
    fireEvent.press(screen.getByText("Cancel"));
    expect(mockBack).toHaveBeenCalled();
  });

  it("normalizes comma-separated price input", async () => {
    mockRequestAPI.mockResolvedValueOnce({ success: true, product: { id: "x" } });

    renderWithQueryClient(<ProductNew />);
    fireEvent.changeText(screen.getByTestId("product-name-input"), "Product");
    fireEvent.changeText(screen.getByTestId("product-price-input"), "10,99");

    await act(async () => {
      fireEvent.press(screen.getByTestId("create-product-button"));
    });

    expect(mockRequestAPI).toHaveBeenCalledWith(
      "/v2/products",
      expect.objectContaining({ data: expect.objectContaining({ price: 1099 }) }),
    );
  });
});
