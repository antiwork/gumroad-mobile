/* eslint-disable import/first -- jest.mock must precede imports */
import { act, fireEvent, render, screen } from "@testing-library/react-native";

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
  it("lists the other accounts and switches on tap", async () => {
    mockSwitchAccount.mockResolvedValue(true);
    mockUseAuth.mockReturnValue({
      accounts: [account("member", "Member"), account("brand", "Brand"), account("shop", "Shop", null)],
      activeAccountId: "member",
      isSwitchingAccount: false,
      switchAccount: mockSwitchAccount,
    });

    render(<SwitchAccountSection />);

    expect(screen.getByText("Switch account")).toBeTruthy();
    expect(screen.getByText("Brand")).toBeTruthy();
    expect(screen.getByText("@brand")).toBeTruthy();
    expect(screen.getByText("Shop")).toBeTruthy();
    expect(screen.queryByText("Member")).toBeNull();

    await act(async () => {
      fireEvent.press(screen.getByTestId("switch-account-brand"));
    });

    expect(mockSwitchAccount).toHaveBeenCalledWith("brand");
  });

  it("reports the switch as done only after it finishes, so the progress stays visible", async () => {
    let finishSwitch: (switched: boolean) => void = () => {};
    mockSwitchAccount.mockReturnValue(
      new Promise<boolean>((resolve) => {
        finishSwitch = resolve;
      }),
    );
    mockUseAuth.mockReturnValue({
      accounts: [account("member", "Member"), account("brand", "Brand")],
      activeAccountId: "member",
      isSwitchingAccount: false,
      switchAccount: mockSwitchAccount,
    });
    const onSwitched = jest.fn();
    const { rerender } = render(<SwitchAccountSection onSwitched={onSwitched} />);

    fireEvent.press(screen.getByTestId("switch-account-brand"));
    mockUseAuth.mockReturnValue({ ...mockUseAuth(), isSwitchingAccount: true });
    rerender(<SwitchAccountSection onSwitched={onSwitched} />);

    expect(onSwitched).not.toHaveBeenCalled();
    expect(screen.getByTestId("switch-account-progress")).toBeTruthy();

    await act(async () => {
      finishSwitch(true);
    });

    expect(onSwitched).toHaveBeenCalledTimes(1);
  });

  it("does not report a failed switch as done", async () => {
    mockSwitchAccount.mockResolvedValue(false);
    mockUseAuth.mockReturnValue({
      accounts: [account("member", "Member"), account("brand", "Brand")],
      activeAccountId: "member",
      isSwitchingAccount: false,
      switchAccount: mockSwitchAccount,
    });
    const onSwitched = jest.fn();
    render(<SwitchAccountSection onSwitched={onSwitched} />);

    await act(async () => {
      fireEvent.press(screen.getByTestId("switch-account-brand"));
    });

    expect(mockSwitchAccount).toHaveBeenCalledWith("brand");
    expect(onSwitched).not.toHaveBeenCalled();
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
