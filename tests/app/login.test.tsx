import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as AuthSession from "expo-auth-session";
import * as SecureStore from "expo-secure-store";
import { Alert } from "react-native";

import LoginScreen from "@/app/login";
import { AuthProvider } from "@/lib/auth-context";
import { request } from "@/lib/request";

jest.mock("expo-auth-session");
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
  AFTER_FIRST_UNLOCK: "after_first_unlock_sentinel",
}));
jest.mock("expo-web-browser", () => ({
  maybeCompleteAuthSession: jest.fn(),
}));
jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: jest.fn() }),
  Redirect: ({ href }: { href: string }) => {
    const { Text } = jest.requireActual("react-native");
    return <Text>{`Redirected to ${href}`}</Text>;
  },
}));
jest.mock("@/lib/request", () => ({
  ...jest.requireActual("@/lib/request"),
  request: jest.fn(),
}));
jest.mock("@/components/styled", () => ({ StyledImage: jest.requireActual("react-native").View }));
jest.mock("@/lib/query-client", () => ({
  queryClient: { clear: jest.fn() },
}));

const mockUseAuthRequest = AuthSession.useAuthRequest as jest.Mock;
const mockRequest = request as jest.Mock;
const mockGetItemAsync = SecureStore.getItemAsync as jest.Mock;
const mockSetItemAsync = SecureStore.setItemAsync as jest.Mock;
const mockDeleteItemAsync = SecureStore.deleteItemAsync as jest.Mock;

const successfulOAuthResponse = (code: string) =>
  ({
    type: "success",
    params: { code },
    authentication: null,
    errorCode: null,
    url: "",
  }) as unknown as AuthSession.AuthSessionResult;

describe("LoginScreen token storage failure", () => {
  let store: Map<string, string>;
  let authResponse: AuthSession.AuthSessionResult | null;
  const promptAsync = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    store = new Map();
    authResponse = null;
    (AuthSession.makeRedirectUri as jest.Mock).mockReturnValue("gumroadmobile://redirect");
    mockUseAuthRequest.mockImplementation(() => [{ codeVerifier: "test-verifier" }, authResponse, promptAsync]);
    mockGetItemAsync.mockImplementation(async (key: string) => store.get(key) ?? null);
    mockDeleteItemAsync.mockImplementation(async (key: string) => {
      store.delete(key);
    });
    mockRequest.mockImplementation(async (url: string) =>
      url.includes("/oauth/token") ? { access_token: "new-access", refresh_token: "new-refresh" } : { products: [] },
    );
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
  });

  it("stays on the sign-in screen with an error and lets the user sign in again once storage works", async () => {
    mockSetItemAsync.mockRejectedValue(new Error("Keystore key generation failed"));
    const renderLogin = () => (
      <AuthProvider>
        <LoginScreen />
      </AuthProvider>
    );
    const { rerender } = render(renderLogin());
    await waitFor(() => expect(screen.getByText("Sign in with Gumroad")).toBeTruthy());

    authResponse = successfulOAuthResponse("auth-code");
    rerender(renderLogin());

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        "Couldn't save your sign-in",
        "Gumroad couldn't save your sign-in securely on this device. Please try again.",
      ),
    );
    await waitFor(() => expect(screen.getByText("Sign in with Gumroad")).toBeTruthy());
    expect(screen.queryByText("Redirected to /")).toBeNull();
    expect(store.size).toBe(0);

    fireEvent.press(screen.getByText("Sign in with Gumroad"));
    await waitFor(() => expect(promptAsync).toHaveBeenCalledTimes(1));

    mockSetItemAsync.mockImplementation(async (key: string, value: string) => {
      store.set(key, value);
    });
    authResponse = successfulOAuthResponse("second-auth-code");
    rerender(renderLogin());

    await waitFor(() => expect(screen.getByText("Redirected to /")).toBeTruthy());
    expect(store.get("gumroad_access_token")).toBe("new-access");
    expect(store.get("gumroad_refresh_token")).toBe("new-refresh");
  });
});
