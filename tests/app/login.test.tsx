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
  biometricLabel: "Face ID",
  biometricIcon: "scan" as const,
  isBiometricSetUp: false,
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

  it("shows biometric button with specific label when set up", () => {
    mockUseAuth.mockReturnValue({ ...baseAuth, isBiometricSetUp: true, biometricLabel: "Face ID", biometricIcon: "scan" });
    render(<LoginScreen />);
    expect(screen.getByText("Sign in with Face ID")).toBeTruthy();
    expect(screen.getByText("Sign in with Gumroad")).toBeTruthy();
  });

  it("shows fingerprint label when biometric type is fingerprint", () => {
    mockUseAuth.mockReturnValue({ ...baseAuth, isBiometricSetUp: true, biometricLabel: "fingerprint", biometricIcon: "fingerprint" });
    render(<LoginScreen />);
    expect(screen.getByText("Sign in with fingerprint")).toBeTruthy();
  });

  it("hides biometric button when not set up", () => {
    mockUseAuth.mockReturnValue({ ...baseAuth, isBiometricSetUp: false });
    render(<LoginScreen />);
    expect(screen.queryByText(/Sign in with Face ID/)).toBeNull();
    expect(screen.queryByText(/Sign in with fingerprint/)).toBeNull();
    expect(screen.getByText("Sign in with Gumroad")).toBeTruthy();
  });

  it("auto-triggers biometric login when set up", () => {
    const loginWithBiometrics = jest.fn();
    mockUseAuth.mockReturnValue({ ...baseAuth, isBiometricSetUp: true, loginWithBiometrics });
    render(<LoginScreen />);
    expect(loginWithBiometrics).toHaveBeenCalled();
  });

  it("does not auto-trigger biometric login when not set up", () => {
    const loginWithBiometrics = jest.fn();
    mockUseAuth.mockReturnValue({ ...baseAuth, isBiometricSetUp: false, loginWithBiometrics });
    render(<LoginScreen />);
    expect(loginWithBiometrics).not.toHaveBeenCalled();
  });
});
