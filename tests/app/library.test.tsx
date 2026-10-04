import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import Library from "@/app/(tabs)/library";
import { resendConfirmationEmail } from "@/lib/email-confirmation";
import { RequestError, UnauthorizedError } from "@/lib/request";

jest.mock("@/lib/email-confirmation", () => {
  const actual = jest.requireActual("@/lib/email-confirmation");
  return { ...actual, resendConfirmationEmail: jest.fn() };
});

const mockResendConfirmationEmail = resendConfirmationEmail as jest.Mock;

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

const mockRefreshToken = jest.fn();
const mockLogout = jest.fn();

jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    isLoading: false,
    accessToken: "test-token",
    refreshToken: mockRefreshToken,
    logout: mockLogout,
  }),
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
  mockResendConfirmationEmail.mockReset();
  mockRefreshToken.mockReset();
  mockLogout.mockReset();
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

describe("Library unconfirmed email", () => {
  const unconfirmedError = () => new RequestError(403, "Request failed: 403 Access denied");

  it("explains the email needs confirming instead of showing the generic connection error", () => {
    mockPurchasesState = { purchases: [], error: unconfirmedError(), isFetching: false };
    render(<Library />);

    expect(screen.queryByText(/Couldn't load your library/)).toBeNull();
    expect(screen.getByText(/confirm your email address/i)).toBeTruthy();
    expect(screen.getByText(/Resend confirmation email/)).toBeTruthy();
  });

  it("keeps the generic error for other failures", () => {
    mockPurchasesState = { purchases: [], error: new RequestError(500, "Request failed: 500"), isFetching: false };
    render(<Library />);

    expect(screen.getByText(/Couldn't load your library/)).toBeTruthy();
    expect(screen.queryByText(/confirm your email address/i)).toBeNull();
  });

  it("sends a fresh confirmation email when the buyer taps resend", async () => {
    mockResendConfirmationEmail.mockResolvedValue("sent");
    mockPurchasesState = { purchases: [], error: unconfirmedError(), isFetching: false };
    render(<Library />);

    fireEvent.press(screen.getByText(/Resend confirmation email/));

    await waitFor(() => expect(mockResendConfirmationEmail).toHaveBeenCalledWith("test-token"));
    expect(await screen.findByText(/Confirmation email sent/)).toBeTruthy();
  });

  it("lets the buyer ask for another email after a successful send", async () => {
    mockResendConfirmationEmail.mockResolvedValue("sent");
    mockPurchasesState = { purchases: [], error: unconfirmedError(), isFetching: false };
    render(<Library />);

    fireEvent.press(screen.getByText(/Resend confirmation email/));
    expect(await screen.findByText(/Confirmation email sent/)).toBeTruthy();

    fireEvent.press(screen.getByText(/Resend confirmation email/));
    await waitFor(() => expect(mockResendConfirmationEmail).toHaveBeenCalledTimes(2));
  });

  it("refreshes an expired session and retries instead of reporting a send failure", async () => {
    mockResendConfirmationEmail
      .mockRejectedValueOnce(new UnauthorizedError("Unauthorized"))
      .mockResolvedValueOnce("sent");
    mockRefreshToken.mockResolvedValue("fresh-token");
    mockPurchasesState = { purchases: [], error: unconfirmedError(), isFetching: false };
    render(<Library />);

    fireEvent.press(screen.getByText(/Resend confirmation email/));

    expect(await screen.findByText(/Confirmation email sent/)).toBeTruthy();
    expect(mockRefreshToken).toHaveBeenCalledTimes(1);
    expect(mockResendConfirmationEmail).toHaveBeenLastCalledWith("fresh-token");
    expect(screen.queryByText(/We couldn't send the email/)).toBeNull();
  });

  it("does not claim success when the resend is throttled", async () => {
    mockResendConfirmationEmail.mockResolvedValue("throttled");
    mockPurchasesState = { purchases: [], error: unconfirmedError(), isFetching: false };
    render(<Library />);

    fireEvent.press(screen.getByText(/Resend confirmation email/));

    expect(await screen.findByText(/try again in a minute/i)).toBeTruthy();
    expect(screen.queryByText(/Confirmation email sent/)).toBeNull();
  });

  it("points an already-confirmed account at the retry instead of claiming an email was sent", async () => {
    mockResendConfirmationEmail.mockResolvedValue("already_confirmed");
    mockPurchasesState = { purchases: [], error: unconfirmedError(), isFetching: false };
    render(<Library />);

    fireEvent.press(screen.getByText(/Resend confirmation email/));

    expect(await screen.findByText(/already confirmed/i)).toBeTruthy();
    expect(screen.queryByText(/Confirmation email sent/)).toBeNull();
  });
});
