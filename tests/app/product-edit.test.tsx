import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { renderWithQueryClient } from "../render-with-query-client";
import ProductEdit from "@/app/products/[id]";
import { Alert } from "react-native";

const mockReplace = jest.fn();
const mockBack = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace, back: mockBack }),
  useLocalSearchParams: () => ({ id: "prod-abc" }),
  Stack: { Screen: jest.fn(() => null) },
}));

jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ isLoading: false, accessToken: "test-token" }),
}));

const mockRequestAPI = jest.fn();
jest.mock("@/lib/request", () => ({
  requestAPI: (...args: unknown[]) => mockRequestAPI(...args),
}));

jest.mock("@sentry/react-native", () => ({
  captureException: jest.fn(),
}));

const makeProductResponse = (overrides = {}) => ({
  success: true,
  product: {
    id: "prod-abc",
    name: "Edit Me",
    description: "Description text",
    price: 1500,
    currency: "usd",
    native_type: "digital",
    subscription_duration: null,
    formatted_price: "$15.00",
    thumbnail_url: null,
    published: true,
    tags: ["design"],
    custom_summary: "A summary",
    deleted: false,
    sales_count: 7,
    sales_usd_cents: 10500,
    short_url: "https://example.gumroad.com/l/edit-me",
    customizable_price: false,
    unique_permalink: "edit-me",
    custom_permalink: "edit-me-custom",
    ...overrides,
  },
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe("ProductEdit screen", () => {
  it("shows loading state while fetching product", () => {
    mockRequestAPI.mockReturnValueOnce(new Promise(() => {}));
    renderWithQueryClient(<ProductEdit />);
    expect(screen.queryByTestId("product-name-input")).toBeNull();
  });

  it("populates form fields after fetch", async () => {
    mockRequestAPI.mockResolvedValueOnce(makeProductResponse());

    renderWithQueryClient(<ProductEdit />);

    await waitFor(() => {
      expect(screen.getByTestId("product-name-input").props.value).toBe("Edit Me");
    });
    expect(screen.getByTestId("product-summary-input").props.value).toBe("A summary");
    expect(screen.getByTestId("product-price-input").props.value).toBe("15.00");
    expect(screen.getByTestId("product-description-input").props.value).toBe("Description text");
  });

  it("shows Published badge for a published product", async () => {
    mockRequestAPI.mockResolvedValueOnce(makeProductResponse({ published: true }));
    renderWithQueryClient(<ProductEdit />);
    await waitFor(() => expect(screen.getByText("Published")).toBeTruthy());
  });

  it("shows Draft badge for an unpublished product", async () => {
    mockRequestAPI.mockResolvedValueOnce(makeProductResponse({ published: false }));
    renderWithQueryClient(<ProductEdit />);
    await waitFor(() => expect(screen.getByText("Draft")).toBeTruthy());
  });

  it("shows error banner on fetch failure", async () => {
    mockRequestAPI.mockRejectedValueOnce(new Error("Not found"));
    renderWithQueryClient(<ProductEdit />);
    await waitFor(() => expect(screen.getByText("Not found")).toBeTruthy());
  });

  it("shows validation error when saving with empty name", async () => {
    mockRequestAPI.mockResolvedValueOnce(makeProductResponse());
    renderWithQueryClient(<ProductEdit />);

    await waitFor(() => screen.getByTestId("product-name-input"));

    fireEvent.changeText(screen.getByTestId("product-name-input"), "");

    await act(async () => {
      fireEvent.press(screen.getByTestId("save-changes-button"));
    });

    expect(screen.getByText("Product name is required.")).toBeTruthy();
  });

  it("shows validation error for invalid price", async () => {
    mockRequestAPI.mockResolvedValueOnce(makeProductResponse());
    renderWithQueryClient(<ProductEdit />);

    await waitFor(() => screen.getByTestId("product-price-input"));

    fireEvent.changeText(screen.getByTestId("product-price-input"), ".");

    await act(async () => {
      fireEvent.press(screen.getByTestId("save-changes-button"));
    });

    expect(screen.getByText("Price must be a valid number.")).toBeTruthy();
  });

  it("saves product and navigates back on success", async () => {
    mockRequestAPI
      .mockResolvedValueOnce(makeProductResponse())
      .mockResolvedValueOnce({});

    renderWithQueryClient(<ProductEdit />);
    await waitFor(() => screen.getByTestId("product-name-input"));

    fireEvent.changeText(screen.getByTestId("product-name-input"), "Updated Name");

    await act(async () => {
      fireEvent.press(screen.getByTestId("save-changes-button"));
    });

    expect(mockRequestAPI).toHaveBeenCalledWith(
      "/v2/products/prod-abc",
      expect.objectContaining({ method: "PUT", data: expect.objectContaining({ name: "Updated Name" }) }),
    );
    expect(mockReplace).toHaveBeenCalledWith("/(tabs)/products");
  });

  it("shows error banner when save fails", async () => {
    mockRequestAPI
      .mockResolvedValueOnce(makeProductResponse())
      .mockRejectedValueOnce(new Error("Save failed"));

    renderWithQueryClient(<ProductEdit />);
    await waitFor(() => screen.getByTestId("save-changes-button"));

    await act(async () => {
      fireEvent.press(screen.getByTestId("save-changes-button"));
    });

    await waitFor(() => expect(screen.getByText("Save failed")).toBeTruthy());
  });

  it("shows delete confirmation alert when delete is pressed", async () => {
    mockRequestAPI.mockResolvedValueOnce(makeProductResponse());
    const alertSpy = jest.spyOn(Alert, "alert");

    renderWithQueryClient(<ProductEdit />);
    await waitFor(() => screen.getByTestId("delete-button"));

    fireEvent.press(screen.getByTestId("delete-button"));

    expect(alertSpy).toHaveBeenCalledWith("Delete product?", "This action cannot be undone.", expect.any(Array));
  });

  it("deletes product and navigates back after confirming", async () => {
    mockRequestAPI
      .mockResolvedValueOnce(makeProductResponse())
      .mockResolvedValueOnce({});

    const alertSpy = jest.spyOn(Alert, "alert");
    renderWithQueryClient(<ProductEdit />);
    await waitFor(() => screen.getByTestId("delete-button"));

    fireEvent.press(screen.getByTestId("delete-button"));

    const buttons = alertSpy.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    await act(async () => {
      buttons.find((b) => b.text === "Delete")?.onPress?.();
      await Promise.resolve();
    });

    expect(mockRequestAPI).toHaveBeenCalledWith(
      "/v2/products/prod-abc",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(mockReplace).toHaveBeenCalledWith("/(tabs)/products");
  });

  it("calls enable endpoint when publishing a draft product", async () => {
    mockRequestAPI
      .mockResolvedValueOnce(makeProductResponse({ published: false }))
      .mockResolvedValueOnce({});

    renderWithQueryClient(<ProductEdit />);
    await waitFor(() => screen.getByTestId("toggle-publish-button"));

    await act(async () => {
      fireEvent.press(screen.getByTestId("toggle-publish-button"));
    });

    expect(mockRequestAPI).toHaveBeenCalledWith(
      "/v2/products/prod-abc/enable",
      expect.objectContaining({ method: "PUT" }),
    );
  });

  it("calls disable endpoint when unpublishing a published product", async () => {
    mockRequestAPI
      .mockResolvedValueOnce(makeProductResponse({ published: true }))
      .mockResolvedValueOnce({});

    renderWithQueryClient(<ProductEdit />);
    await waitFor(() => screen.getByTestId("toggle-publish-button"));

    await act(async () => {
      fireEvent.press(screen.getByTestId("toggle-publish-button"));
    });

    expect(mockRequestAPI).toHaveBeenCalledWith(
      "/v2/products/prod-abc/disable",
      expect.objectContaining({ method: "PUT" }),
    );
  });

  it("hides permalink field for coffee products", async () => {
    mockRequestAPI.mockResolvedValueOnce(makeProductResponse({ native_type: "coffee" }));
    renderWithQueryClient(<ProductEdit />);
    await waitFor(() => screen.getByTestId("product-name-input"));
    expect(screen.queryByTestId("product-permalink-input")).toBeNull();
  });

  it("shows permalink field for non-coffee products", async () => {
    mockRequestAPI.mockResolvedValueOnce(makeProductResponse({ native_type: "digital" }));
    renderWithQueryClient(<ProductEdit />);
    await waitFor(() => screen.getByTestId("product-permalink-input"));
    expect(screen.getByTestId("product-permalink-input")).toBeTruthy();
  });

  it("shows tags when present", async () => {
    mockRequestAPI.mockResolvedValueOnce(makeProductResponse({ tags: ["art", "ebook"] }));
    renderWithQueryClient(<ProductEdit />);
    await waitFor(() => screen.getByText("Tags: art, ebook"));
  });
});
