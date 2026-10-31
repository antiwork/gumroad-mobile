/* eslint-disable import/first -- jest.mock must precede imports */
import { renderRouter } from "expo-router/testing-library";
import { Text } from "react-native";

jest.mock("react-native-safe-area-context", () => jest.requireActual("react-native-safe-area-context"));
jest.mock("@/components/mini-audio-player", () => ({ MiniAudioPlayer: () => null }));
jest.mock("@/components/ui/loading-spinner", () => ({ LoadingSpinner: () => null }));
jest.mock("@/components/use-user", () => ({ useUser: () => ({ data: undefined, isLoading: false }) }));
jest.mock("@/lib/tab-preference", () => ({ saveLastTab: jest.fn() }));
jest.mock("react-native-webview", () => ({ WebView: () => null }));
jest.mock("uniwind", () => ({
  ...jest.requireActual("uniwind"),
  useCSSVariable: () => ["#000000", "#ffffff", "#cccccc"],
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
    ],
    activeAccountId: "member",
    isSwitchingAccount: false,
    switchAccount: jest.fn(),
    logout: jest.fn(),
  }),
}));

import TabsLayout from "@/app/(tabs)/_layout";

const Stub = () => <Text>stub</Text>;

describe("(tabs) layout", () => {
  it("renders the custom tab bar inside the navigator's own theme", async () => {
    await renderRouter(
      {
        "(tabs)/_layout": TabsLayout,
        "(tabs)/dashboard": Stub,
        "(tabs)/products": Stub,
        "(tabs)/analytics": Stub,
        "(tabs)/agent": Stub,
        "(tabs)/library": Stub,
      },
      { initialUrl: "/dashboard" },
    );
  });
});
