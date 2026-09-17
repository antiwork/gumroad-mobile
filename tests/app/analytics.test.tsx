import { render, screen } from "@testing-library/react-native";

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
}));

const mockUseAuth = jest.fn();
jest.mock("@/lib/auth-context", () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock("@/components/analytics/sales-tab", () => {
  const { Text } = jest.requireActual<typeof import("react-native")>("react-native");
  return { SalesTab: () => <Text>sales-tab</Text> };
});
jest.mock("@/components/analytics/traffic-tab", () => {
  const { Text } = jest.requireActual<typeof import("react-native")>("react-native");
  return { TrafficTab: () => <Text>traffic-tab</Text> };
});
jest.mock("@/components/export-all-sales-button", () => ({
  ExportAllSalesButton: () => null,
}));

/* eslint-disable import/first -- jest.mock must precede imports */
import Analytics from "@/app/(tabs)/analytics";
/* eslint-enable import/first */

const PLACEHOLDER = "You're just getting started.";

describe("Analytics", () => {
  const mockRefreshCreatorStatus = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows the getting-started placeholder when the user is known to have no products", () => {
    mockUseAuth.mockReturnValue({ isCreator: false, refreshCreatorStatus: mockRefreshCreatorStatus });
    render(<Analytics />);
    expect(screen.getByText(PLACEHOLDER)).toBeTruthy();
    expect(screen.queryByText("sales-tab")).toBeNull();
    expect(mockRefreshCreatorStatus).not.toHaveBeenCalled();
  });

  it("shows analytics when the user is a creator", () => {
    mockUseAuth.mockReturnValue({ isCreator: true, refreshCreatorStatus: mockRefreshCreatorStatus });
    render(<Analytics />);
    expect(screen.getByText("sales-tab")).toBeTruthy();
    expect(screen.queryByText(PLACEHOLDER)).toBeNull();
  });

  it("does not show the placeholder while creator status is unknown, and re-probes it", () => {
    mockUseAuth.mockReturnValue({ isCreator: null, refreshCreatorStatus: mockRefreshCreatorStatus });
    render(<Analytics />);
    expect(screen.queryByText(PLACEHOLDER)).toBeNull();
    expect(screen.getByText("sales-tab")).toBeTruthy();
    expect(mockRefreshCreatorStatus).toHaveBeenCalledTimes(1);
  });
});
