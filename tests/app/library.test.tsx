import { fireEvent, render, screen } from "@testing-library/react-native";
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

const mockResend = jest.fn();
let mockResendState: { state: string; secondsLeft: number; isSending: boolean } = {
  state: "idle",
  secondsLeft: 0,
  isSending: false,
};
jest.mock("@/components/library/use-resend-confirmation-email", () => ({
  useResendConfirmationEmail: () => ({ resend: mockResend, ...mockResendState }),
}));

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

const mockRefetch = jest.fn();
const mockRecentRefetch = jest.fn();
const mockFetchNextPage = jest.fn();
let mockPurchasesState: {
  purchases: ReturnType<typeof mockMakePurchase>[];
  error: Error | null;
  isFetching: boolean;
  isFetchNextPageError?: boolean;
};

jest.mock("@/components/library/use-purchases", () => ({
  usePurchases: () => ({
    purchases: mockPurchasesState.purchases,
    totalCount: mockPurchasesState.purchases.length,
    error: mockPurchasesState.error,
    isFetching: mockPurchasesState.isFetching,
    isFetchingNextPage: false,
    isFetchNextPageError: mockPurchasesState.isFetchNextPageError ?? false,
    hasNextPage: false,
    fetchNextPage: mockFetchNextPage,
    refetch: mockRefetch,
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
    refetch: mockRecentRefetch,
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

jest.mock("@/components/ui/button", () => {
  const { Pressable } = require("react-native");
  return {
    Button: ({
      children,
      onPress,
      disabled,
    }: {
      children: React.ReactNode;
      onPress: () => void;
      disabled?: boolean;
    }) => (
      <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled}>
        {children}
      </Pressable>
    ),
  };
});

jest.mock("@/components/ui/text", () => {
  const { Text } = require("react-native");
  return { Text };
});

beforeEach(() => {
  mockPurchasesState = { purchases: mockPurchases, error: null, isFetching: false };
  mockRefetch.mockClear();
  mockRecentRefetch.mockClear();
  mockFetchNextPage.mockClear();
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

describe("Library load error", () => {
  it("shows a readable message and a retry button instead of the raw error", () => {
    mockPurchasesState = { purchases: [], error: new Error("Aborted"), isFetching: false };
    render(<Library />);

    expect(screen.queryByText(/Aborted/)).toBeNull();
    expect(screen.getByText(/Couldn't load your library/)).toBeTruthy();

    fireEvent.press(screen.getByRole("button"));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
    expect(mockRecentRefetch).toHaveBeenCalledTimes(1);
  });

  it("disables retry while a refetch is in flight", () => {
    mockPurchasesState = { purchases: [], error: new Error("Aborted"), isFetching: true };
    render(<Library />);

    fireEvent.press(screen.getByRole("button"));
    expect(mockRefetch).not.toHaveBeenCalled();
  });

  it("keeps already-loaded purchases on screen when a later fetch fails", () => {
    mockPurchasesState = { purchases: mockPurchases, error: new Error("Aborted"), isFetching: false };
    render(<Library />);

    expect(screen.getAllByText("Product 1").length).toBeGreaterThan(0);
    expect(screen.queryByText(/Couldn't load your library/)).toBeNull();
    expect(screen.queryByText(/Couldn't load more purchases/)).toBeNull();
  });

  it("shows a retry footer when loading the next page fails", () => {
    mockPurchasesState = {
      purchases: mockPurchases,
      error: new Error("Aborted"),
      isFetching: false,
      isFetchNextPageError: true,
    };
    render(<Library />);

    expect(screen.getAllByText("Product 1").length).toBeGreaterThan(0);
    expect(screen.getByText(/Couldn't load more purchases/)).toBeTruthy();

    fireEvent.press(screen.getByRole("button"));
    expect(mockFetchNextPage).toHaveBeenCalledTimes(1);
  });
});

describe("Library with an unconfirmed email", () => {
  beforeEach(() => {
    mockResendState = { state: "idle", secondsLeft: 0, isSending: false };
    mockResend.mockClear();
  });

  const unconfirmedError = () =>
    Object.assign(new Error("Request failed: 403 Access denied"), {
      name: "RequestError",
      statusCode: 403,
      serverMessage: "Please confirm your email address before you can see your purchases.",
    });

  it("asks the buyer to confirm their email instead of showing the generic load error", () => {
    mockPurchasesState = { purchases: [], error: unconfirmedError(), isFetching: false };
    render(<Library />);

    expect(screen.getByText("Confirm your email to see your library")).toBeTruthy();
    expect(screen.queryByText(/Couldn't load your library/)).toBeNull();
    expect(screen.queryByText("Retry")).toBeNull();
    expect(screen.getByText("Send the email again")).toBeTruthy();
  });

  it("reloads the library when the buyer says they confirmed", () => {
    mockPurchasesState = { purchases: [], error: unconfirmedError(), isFetching: false };
    render(<Library />);

    fireEvent.press(screen.getByText("I've confirmed my email"));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
    expect(mockRecentRefetch).toHaveBeenCalledTimes(1);
  });
  it("sends a new confirmation email when the buyer asks for one", () => {
    mockPurchasesState = { purchases: [], error: unconfirmedError(), isFetching: false };
    render(<Library />);

    fireEvent.press(screen.getByText("Send the email again"));
    expect(mockResend).toHaveBeenCalledTimes(1);
    expect(mockRefetch).not.toHaveBeenCalled();
  });

  it("shows the wait time and blocks another resend during the cooldown", () => {
    mockResendState = { state: "sent", secondsLeft: 42, isSending: false };
    mockPurchasesState = { purchases: [], error: unconfirmedError(), isFetching: false };
    render(<Library />);

    expect(screen.getByText("We sent you a new email. Check your inbox and spam folder.")).toBeTruthy();
    fireEvent.press(screen.getByText("Send again in 42s"));
    expect(mockResend).not.toHaveBeenCalled();
  });

  it("explains a failed resend", () => {
    mockResendState = { state: "failed", secondsLeft: 0, isSending: false };
    mockPurchasesState = { purchases: [], error: unconfirmedError(), isFetching: false };
    render(<Library />);

    expect(screen.getByText("We couldn't send the email. Check your connection and try again.")).toBeTruthy();
  });

  it("disables the button while a reload is in flight", () => {
    mockPurchasesState = { purchases: [], error: unconfirmedError(), isFetching: true };
    render(<Library />);

    fireEvent.press(screen.getByText("I've confirmed my email"));
    expect(mockRefetch).not.toHaveBeenCalled();
  });

  it("keeps the generic error and Retry for other 403 responses", () => {
    const forbidden = Object.assign(new Error("Request failed: 403 Access denied"), {
      name: "RequestError",
      statusCode: 403,
    });
    mockPurchasesState = { purchases: [], error: forbidden, isFetching: false };
    render(<Library />);

    expect(screen.getByText(/Couldn't load your library/)).toBeTruthy();
    expect(screen.queryByText("Confirm your email to see your library")).toBeNull();
  });
});
