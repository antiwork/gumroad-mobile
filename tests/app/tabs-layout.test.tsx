/* eslint-disable import/first -- jest.mock must precede imports */
import { fireEvent, render, screen, within } from "@testing-library/react-native";
import { ReactNode } from "react";

jest.mock("expo-router", () => {
  const TabsScreen = ({ name, options }: { name: string; options: { headerRight?: () => ReactNode } }) =>
    name === "dashboard" ? (options.headerRight?.() ?? null) : null;
  const Tabs = Object.assign(({ children }: { children: ReactNode }) => children, { Screen: TabsScreen });
  return {
    Tabs,
    usePathname: () => "/dashboard",
    useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  };
});
const BRAND_ACCOUNT_COUNT = 12;

jest.mock("@react-navigation/bottom-tabs", () => ({ BottomTabBar: () => null }));
jest.mock("@/components/mini-audio-player", () => ({ MiniAudioPlayer: () => null }));
jest.mock("@/components/use-user", () => ({ useUser: () => ({ data: undefined, isLoading: false }) }));
jest.mock("@/lib/tab-preference", () => ({ saveLastTab: jest.fn() }));
jest.mock("react-native-webview", () => ({ WebView: () => null }));
jest.mock("uniwind", () => ({
  ...jest.requireActual("uniwind"),
  useCSSVariable: () => ["#000000", "#ffffff", "#cccccc"],
}));

const mockBrandAccounts = Array.from({ length: BRAND_ACCOUNT_COUNT }, (_, index) => ({
  accountId: `brand-${index}`,
  name: `Brand ${index}`,
  username: `brand${index}`,
  avatarUrl: null,
  accessToken: null,
  refreshToken: null,
}));

jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    accounts: [
      {
        accountId: "member",
        name: "Member",
        username: "member",
        avatarUrl: null,
        accessToken: null,
        refreshToken: null,
      },
      ...mockBrandAccounts,
    ],
    activeAccountId: "member",
    isSwitchingAccount: false,
    switchAccount: jest.fn(),
    logout: jest.fn(),
  }),
}));

import TabsLayout from "@/app/(tabs)/_layout";

describe("TabsLayout settings sheet", () => {
  it("puts every settings section, including all switchable accounts, inside a scroll view", () => {
    render(<TabsLayout />);

    fireEvent.press(screen.getByTestId("settings-button"));

    const scrollView = within(screen.getByTestId("settings-scroll-view"));
    expect(scrollView.getByText("Feedback")).toBeTruthy();
    expect(scrollView.getByTestId("switch-account-brand-0")).toBeTruthy();
    expect(scrollView.getByTestId(`switch-account-brand-${BRAND_ACCOUNT_COUNT - 1}`)).toBeTruthy();
    expect(scrollView.getByText("Danger Zone")).toBeTruthy();
  });
});
