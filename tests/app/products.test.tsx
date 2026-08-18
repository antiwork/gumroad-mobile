import { fireEvent, render, screen } from "@testing-library/react-native";

const mockPush = jest.fn();
const mockRefetch = jest.fn();
const mockMutate = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
  useFocusEffect: jest.fn(),
}));

jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ isLoading: false, accessToken: "test-token" }),
}));

jest.mock("@/components/styled", () => {
  const { View } = require("react-native");
  return {
    StyledImage: (props: Record<string, unknown>) => <View testID="styled-image" {...props} />,
  };
});

const mockProducts = [
  {
    id: "abc",
    name: "Writing guide",
    permalink: "abc",
    price_formatted: "$10",
    status: "published" as const,
    thumbnail_url: null,
    can_edit: true,
    can_destroy: true,
  },
];

let mockProductsState = {
  products: mockProducts,
  isLoading: false,
  error: null as Error | null,
  refetch: mockRefetch,
  isRefetching: false,
  fetchNextPage: jest.fn(),
  hasNextPage: false,
  isFetchingNextPage: false,
};

jest.mock("@/components/products/use-products", () => ({
  useProducts: () => mockProductsState,
  useDeleteProduct: () => ({ mutate: mockMutate }),
}));

import Products from "@/app/(tabs)/products";

describe("Products", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockProductsState = {
      products: mockProducts,
      isLoading: false,
      error: null,
      refetch: mockRefetch,
      isRefetching: false,
      fetchNextPage: jest.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    };
  });

  it("lists products and opens the editor", () => {
    render(<Products />);

    fireEvent.press(screen.getByLabelText("Writing guide"));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/edit-product",
      params: { permalink: "abc", name: "Writing guide" },
    });
  });

  it("shows the getting-started empty state", () => {
    mockProductsState = { ...mockProductsState, products: [] };
    render(<Products />);

    expect(screen.getByText("Create your first product")).toBeTruthy();
  });
});
