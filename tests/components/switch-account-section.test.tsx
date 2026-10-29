/* eslint-disable import/first -- jest.mock must precede imports */
import { fireEvent, render, screen } from "@testing-library/react-native";

const mockSwitchAccount = jest.fn();
const mockUseAuth = jest.fn();

jest.mock("@/lib/auth-context", () => ({ useAuth: () => mockUseAuth() }));
jest.mock("react-native-webview", () => ({ WebView: () => null }));

import { SwitchAccountSection } from "@/components/switch-account-section";

const account = (accountId: string, name: string, username: string | null = name.toLowerCase()) => ({
  accountId,
  name,
  username,
  avatarUrl: null,
  accessToken: null,
  refreshToken: null,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe("SwitchAccountSection", () => {
  it("lists the other accounts and switches on tap", () => {
    const onSwitchStart = jest.fn();
    mockUseAuth.mockReturnValue({
      accounts: [account("member", "Member"), account("brand", "Brand"), account("shop", "Shop", null)],
      activeAccountId: "member",
      isSwitchingAccount: false,
      switchAccount: mockSwitchAccount,
    });

    render(<SwitchAccountSection onSwitchStart={onSwitchStart} />);

    expect(screen.getByText("Switch account")).toBeTruthy();
    expect(screen.getByText("Brand")).toBeTruthy();
    expect(screen.getByText("@brand")).toBeTruthy();
    expect(screen.getByText("Shop")).toBeTruthy();
    expect(screen.queryByText("Member")).toBeNull();

    fireEvent.press(screen.getByTestId("switch-account-brand"));

    expect(onSwitchStart).toHaveBeenCalled();
    expect(mockSwitchAccount).toHaveBeenCalledWith("brand");
  });

  it("is hidden when there is only one account", () => {
    mockUseAuth.mockReturnValue({
      accounts: [account("member", "Member")],
      activeAccountId: "member",
      isSwitchingAccount: false,
      switchAccount: mockSwitchAccount,
    });

    render(<SwitchAccountSection />);

    expect(screen.queryByTestId("switch-account-section")).toBeNull();
  });

  it("disables the rows while a switch is in progress", () => {
    mockUseAuth.mockReturnValue({
      accounts: [account("member", "Member"), account("brand", "Brand")],
      activeAccountId: "member",
      isSwitchingAccount: true,
      switchAccount: mockSwitchAccount,
    });

    render(<SwitchAccountSection />);
    fireEvent.press(screen.getByTestId("switch-account-brand"));

    expect(mockSwitchAccount).not.toHaveBeenCalled();
  });
});
