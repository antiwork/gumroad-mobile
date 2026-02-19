import { render, screen } from "@testing-library/react-native";

const mockUseAuth = jest.fn();
jest.mock("@/lib/auth-context", () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock("expo-router", () => ({
  Redirect: () => null,
}));

jest.mock("expo-web-browser", () => ({
  warmUpAsync: jest.fn(),
  coolDownAsync: jest.fn(),
}));

jest.mock("uniwind", () => ({
  useUniwind: () => ({ theme: "light" }),
  withUniwind: (component: unknown) => component,
}));

jest.mock("../../components/styled", () => ({
  StyledImage: () => null,
}));

import LoginScreen from "@/app/login";

const baseAuth = {
  isAuthenticated: false,
  isLoading: false,
  isCreator: false,
  accessToken: null,
  biometricEnabled: false,
  canUseBiometric: false,
  login: jest.fn(),
  logout: jest.fn(),
  refreshToken: jest.fn(),
  loginWithBiometrics: jest.fn(),
  handleSessionExpiry: jest.fn(),
};

describe("LoginScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows biometric button when canUseBiometric is true", () => {
    mockUseAuth.mockReturnValue({ ...baseAuth, canUseBiometric: true });
    render(<LoginScreen />);
    expect(screen.getByText("Sign in with biometrics")).toBeTruthy();
    expect(screen.getByText("Sign in with Gumroad")).toBeTruthy();
  });

  it("hides biometric button when canUseBiometric is false", () => {
    mockUseAuth.mockReturnValue({ ...baseAuth, canUseBiometric: false });
    render(<LoginScreen />);
    expect(screen.queryByText("Sign in with biometrics")).toBeNull();
    expect(screen.getByText("Sign in with Gumroad")).toBeTruthy();
  });

  it("auto-triggers biometric login when canUseBiometric is true", () => {
    const loginWithBiometrics = jest.fn();
    mockUseAuth.mockReturnValue({ ...baseAuth, canUseBiometric: true, loginWithBiometrics });
    render(<LoginScreen />);
    expect(loginWithBiometrics).toHaveBeenCalled();
  });

  it("does not auto-trigger biometric login when canUseBiometric is false", () => {
    const loginWithBiometrics = jest.fn();
    mockUseAuth.mockReturnValue({ ...baseAuth, canUseBiometric: false, loginWithBiometrics });
    render(<LoginScreen />);
    expect(loginWithBiometrics).not.toHaveBeenCalled();
  });
});
