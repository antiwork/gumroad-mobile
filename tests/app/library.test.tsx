import { render } from "@testing-library/react-native";
import Library from "@/app/(tabs)/library";

const imageProps: Record<string, unknown>[] = [];

jest.mock("@/components/styled", () => {
  const { View } = require("react-native");
  return {
    StyledImage: (props: Record<string, unknown>) => {
      imageProps.push(props);
      return <View testID="styled-image" {...props} />;
    },
  };
});

jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ isLoading: false, accessToken: "test-token" }),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
  useFocusEffect: jest.fn(),
}));

jest.mock("@sentry/react-native", () => ({ captureException: jest.fn() }));

jest.mock("react-native-context-menu-view", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
  };
});

const mockMakePurchase = (id: string) => ({
  name: `Product ${id}`,
  unique_permalink: id,
  creator_name: "Creator",
  creator_username: "creator",
  creator_profile_url: "https://example.com/creator",
  creator_profile_picture_url: "https://example.com/avatar.png",
  thumbnail_url: "https://example.com/thumb.gif",
  url_redirect_token: `token-${id}`,
  purchase_email: "buyer@test.com",
  purchase_id: `purchase-${id}`,
});

const mockPurchases = [mockMakePurchase("1"), mockMakePurchase("2")];

jest.mock("@/components/library/use-library-filters", () => ({
  useLibraryFilters: () => ({
    searchText: "",
    hasActiveFilters: false,
    apiFilters: {},
    isSearchPending: false,
  }),
}));

jest.mock("@/components/library/use-purchases", () => ({
  usePurchases: () => ({
    purchases: mockPurchases,
    totalCount: mockPurchases.length,
    error: null,
    isFetching: false,
    isFetchingNextPage: false,
    hasNextPage: false,
    fetchNextPage: jest.fn(),
    refetch: jest.fn(),
  }),
  useSellers: () => [],
  useArchivePurchase: () => jest.fn(),
  useDeletePurchase: () => jest.fn(),
}));

jest.mock("@/components/library/use-recent-products", () => ({
  MAX_RECENT: 5,
  useRecentPurchases: () => ({
    purchases: [],
    isLoading: false,
    refresh: jest.fn(),
    refetch: jest.fn(),
  }),
}));

jest.mock("@/components/library/library-filters", () => {
  const { View } = require("react-native");
  return {
    LibraryFilters: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
  };
});

jest.mock("@/components/ui/screen", () => {
  const { View } = require("react-native");
  return { Screen: ({ children }: { children: React.ReactNode }) => <View>{children}</View> };
});

jest.mock("@/components/ui/loading-spinner", () => {
  const { View } = require("react-native");
  return { LoadingSpinner: () => <View /> };
});

jest.mock("@/components/ui/text", () => {
  const { Text } = require("react-native");
  return { Text };
});

describe("Library image autoplay", () => {
  beforeEach(() => {
    imageProps.length = 0;
  });

  it("renders all images with autoplay disabled", () => {
    render(<Library />);
    expect(imageProps.length).toBeGreaterThan(0);
    imageProps.forEach((props) => {
      expect(props.autoplay).toBe(false);
    });
  });
});
