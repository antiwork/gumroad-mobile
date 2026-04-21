import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { renderWithQueryClient } from "../render-with-query-client";
import Products from "@/app/(tabs)/products";
import { RawProduct } from "@/lib/product-api";

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require("react");
    useEffect(cb, []);
  },
}));

jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ isLoading: false, accessToken: "test-token", isCreator: true }),
}));

jest.mock("@/app/(tabs)/_layout", () => ({
  useProductsSearch: () => ({ isProductSearchActive: false, setProductSearchActive: jest.fn() }),
}));

const mockRequestAPI = jest.fn();
jest.mock("@/lib/request", () => ({
  requestAPI: (...args: unknown[]) => mockRequestAPI(...args),
}));

jest.mock("@sentry/react-native", () => ({
  captureException: jest.fn(),
  captureMessage: jest.fn(),
}));

const makeRawProduct = (overrides: Partial<RawProduct> = {}): RawProduct => ({
  id: "prod-1",
  name: "Test Product",
  description: "A desc",
  price: 1000,
  currency: "usd",
  formatted_price: "$10.00",
  thumbnail_url: null,
  published: true,
  tags: [],
  custom_summary: "",
  deleted: false,
  sales_count: 2,
  sales_usd_cents: 2000,
  short_url: "https://example.gumroad.com/l/test",
  customizable_price: false,
  unique_permalink: "test",
  custom_permalink: null,
  native_type: "digital",
  subscription_duration: null,
  ...overrides,
});

const mockSuccessResponse = (products: RawProduct[], next_page_key?: string) =>
  Promise.resolve({ success: true, products, next_page_key });

beforeEach(() => {
  jest.clearAllMocks();
});

describe("Products screen", () => {
  it("shows loading spinner while fetching", async () => {
    let resolveRequest: (v: unknown) => void;
    mockRequestAPI.mockReturnValueOnce(new Promise((res) => (resolveRequest = res)));

    renderWithQueryClient(<Products />);

    expect(screen.getByTestId("products-list")).toBeTruthy();
    resolveRequest!({ success: true, products: [] });
  });

  it("renders product cards after successful fetch", async () => {
    mockRequestAPI.mockReturnValueOnce(mockSuccessResponse([makeRawProduct()]));

    renderWithQueryClient(<Products />);

    await waitFor(() => {
      expect(screen.getByText("Test Product")).toBeTruthy();
    });
  });

  it("renders revenue and sales stat cards", async () => {
    mockRequestAPI.mockReturnValueOnce(
      mockSuccessResponse([makeRawProduct({ sales_usd_cents: 5000, sales_count: 3 })]),
    );

    renderWithQueryClient(<Products />);

    await waitFor(() => {
      expect(screen.getByTestId("revenue-stat")).toBeTruthy();
      expect(screen.getByTestId("sales-stat")).toBeTruthy();
    });
  });

  it("shows empty state when no products exist", async () => {
    mockRequestAPI.mockReturnValueOnce(mockSuccessResponse([]));

    renderWithQueryClient(<Products />);

    await waitFor(() => {
      expect(screen.getByText("No products yet")).toBeTruthy();
    });
  });

  it("shows 'Create your first product' CTA when no products", async () => {
    mockRequestAPI.mockReturnValueOnce(mockSuccessResponse([]));

    renderWithQueryClient(<Products />);

    await waitFor(() => {
      expect(screen.getByText("Create your first product")).toBeTruthy();
    });
  });

  it("shows error state and retry button on fetch failure", async () => {
    mockRequestAPI.mockRejectedValueOnce(new Error("Network error"));

    renderWithQueryClient(<Products />);

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeTruthy();
      expect(screen.getByText("Retry")).toBeTruthy();
    });
  });

  it("retries fetch when Retry is pressed", async () => {
    mockRequestAPI
      .mockRejectedValueOnce(new Error("fail"))
      .mockReturnValueOnce(mockSuccessResponse([makeRawProduct()]));

    renderWithQueryClient(<Products />);

    await waitFor(() => screen.getByText("Retry"));
    await act(async () => {
      fireEvent.press(screen.getByText("Retry"));
    });

    await waitFor(() => {
      expect(screen.getByText("Test Product")).toBeTruthy();
    });
  });

  it("navigates to edit screen when a product is pressed", async () => {
    mockRequestAPI.mockReturnValueOnce(mockSuccessResponse([makeRawProduct({ id: "abc" })]));

    renderWithQueryClient(<Products />);

    await waitFor(() => screen.getByTestId("product-card-abc"));
    fireEvent.press(screen.getByTestId("product-card-abc"));

    expect(mockPush).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: "/products/[id]", params: expect.objectContaining({ id: "abc" }) }),
    );
  });

  it("filters products by published status", async () => {
    mockRequestAPI.mockReturnValueOnce(
      mockSuccessResponse([
        makeRawProduct({ id: "1", name: "Published One", published: true }),
        makeRawProduct({ id: "2", name: "Draft One", published: false }),
      ]),
    );

    renderWithQueryClient(<Products />);

    await waitFor(() => screen.getByText("Published One"));

    fireEvent.press(screen.getByTestId("status-filter-published"));

    expect(screen.getByText("Published One")).toBeTruthy();
    expect(screen.queryByText("Draft One")).toBeNull();
  });

  it("filters products by draft status", async () => {
    mockRequestAPI.mockReturnValueOnce(
      mockSuccessResponse([
        makeRawProduct({ id: "1", name: "Published One", published: true }),
        makeRawProduct({ id: "2", name: "Draft One", published: false }),
      ]),
    );

    renderWithQueryClient(<Products />);

    await waitFor(() => screen.getByText("Draft One"));

    fireEvent.press(screen.getByTestId("status-filter-draft"));

    expect(screen.queryByText("Published One")).toBeNull();
    expect(screen.getByText("Draft One")).toBeTruthy();
  });

  it("fetches next page when list end is reached and a page key exists", async () => {
    mockRequestAPI
      .mockReturnValueOnce(
        mockSuccessResponse([makeRawProduct({ id: "1", name: "First" })], "page-key-2"),
      )
      .mockReturnValueOnce(mockSuccessResponse([makeRawProduct({ id: "2", name: "Second" })]));

    renderWithQueryClient(<Products />);

    await waitFor(() => screen.getByText("First"));

    await act(async () => {
      fireEvent(screen.getByTestId("products-list"), "onEndReached");
    });

    await waitFor(() => {
      expect(mockRequestAPI).toHaveBeenCalledTimes(2);
    });
  });

  it("shows 'No products match your filters' empty state when filter returns nothing", async () => {
    mockRequestAPI.mockReturnValueOnce(
      mockSuccessResponse([makeRawProduct({ id: "1", name: "Published One", published: true })]),
    );

    renderWithQueryClient(<Products />);

    await waitFor(() => screen.getByText("Published One"));

    fireEvent.press(screen.getByTestId("status-filter-draft"));

    expect(screen.getByText("No products match your filters")).toBeTruthy();
  });
});
