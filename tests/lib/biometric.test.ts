import { authenticate, getBiometricLabel, isBiometricEnabled, isBiometricSupported, setBiometricEnabled } from "@/lib/biometric";

const mockHasHardwareAsync = jest.fn();
const mockIsEnrolledAsync = jest.fn();
const mockAuthenticateAsync = jest.fn();
const mockSupportedAuthenticationTypesAsync = jest.fn();
jest.mock("expo-local-authentication", () => ({
  hasHardwareAsync: () => mockHasHardwareAsync(),
  isEnrolledAsync: () => mockIsEnrolledAsync(),
  authenticateAsync: (opts: unknown) => mockAuthenticateAsync(opts),
  supportedAuthenticationTypesAsync: () => mockSupportedAuthenticationTypesAsync(),
  AuthenticationType: {
    FINGERPRINT: 1,
    FACIAL_RECOGNITION: 2,
    IRIS: 3,
  },
}));

const mockGetItemAsync = jest.fn();
const mockSetItemAsync = jest.fn();
const mockDeleteItemAsync = jest.fn();
jest.mock("expo-secure-store", () => ({
  getItemAsync: (key: string) => mockGetItemAsync(key),
  setItemAsync: (key: string, value: string) => mockSetItemAsync(key, value),
  deleteItemAsync: (key: string) => mockDeleteItemAsync(key),
}));

jest.mock("react-native", () => ({
  Platform: { OS: "ios" },
}));

describe("biometric", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("isBiometricSupported", () => {
    it("returns true when hardware and enrollment are available", async () => {
      mockHasHardwareAsync.mockResolvedValue(true);
      mockIsEnrolledAsync.mockResolvedValue(true);
      expect(await isBiometricSupported()).toBe(true);
    });

    it("returns false when no hardware is available", async () => {
      mockHasHardwareAsync.mockResolvedValue(false);
      mockIsEnrolledAsync.mockResolvedValue(true);
      expect(await isBiometricSupported()).toBe(false);
    });

    it("returns false when biometrics are not enrolled", async () => {
      mockHasHardwareAsync.mockResolvedValue(true);
      mockIsEnrolledAsync.mockResolvedValue(false);
      expect(await isBiometricSupported()).toBe(false);
    });
  });

  describe("isBiometricEnabled", () => {
    it("returns true when stored value is 'true'", async () => {
      mockGetItemAsync.mockResolvedValue("true");
      expect(await isBiometricEnabled()).toBe(true);
    });

    it("returns false when stored value is null", async () => {
      mockGetItemAsync.mockResolvedValue(null);
      expect(await isBiometricEnabled()).toBe(false);
    });
  });

  describe("setBiometricEnabled", () => {
    it("stores 'true' when enabling", async () => {
      await setBiometricEnabled(true);
      expect(mockSetItemAsync).toHaveBeenCalledWith("gumroad_biometric_enabled", "true");
    });

    it("deletes the key when disabling", async () => {
      await setBiometricEnabled(false);
      expect(mockDeleteItemAsync).toHaveBeenCalledWith("gumroad_biometric_enabled");
    });
  });

  describe("authenticate", () => {
    it("returns true on successful authentication", async () => {
      mockAuthenticateAsync.mockResolvedValue({ success: true });
      expect(await authenticate()).toBe(true);
      expect(mockAuthenticateAsync).toHaveBeenCalledWith({
        promptMessage: "Log in to Gumroad",
        cancelLabel: "Use password",
        disableDeviceFallback: true,
      });
    });

    it("returns false when authentication fails", async () => {
      mockAuthenticateAsync.mockResolvedValue({ success: false, error: "user_cancel" });
      expect(await authenticate()).toBe(false);
    });
  });

  describe("getBiometricLabel", () => {
    it("returns Face ID for facial recognition on iOS", async () => {
      mockSupportedAuthenticationTypesAsync.mockResolvedValue([2]);
      const result = await getBiometricLabel();
      expect(result).toEqual({ label: "Face ID", icon: "scan" });
    });

    it("returns Touch ID for fingerprint on iOS", async () => {
      mockSupportedAuthenticationTypesAsync.mockResolvedValue([1]);
      const result = await getBiometricLabel();
      expect(result).toEqual({ label: "Touch ID", icon: "fingerprint" });
    });

    it("prefers facial recognition when multiple types are available", async () => {
      mockSupportedAuthenticationTypesAsync.mockResolvedValue([1, 2]);
      const result = await getBiometricLabel();
      expect(result).toEqual({ label: "Face ID", icon: "scan" });
    });

    it("returns biometrics as fallback when no known type", async () => {
      mockSupportedAuthenticationTypesAsync.mockResolvedValue([]);
      const result = await getBiometricLabel();
      expect(result).toEqual({ label: "biometrics", icon: "fingerprint" });
    });
  });
});
