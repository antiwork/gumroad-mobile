import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const BIOMETRIC_ENABLED_KEY = "gumroad_biometric_enabled";

export const isBiometricSupported = async (): Promise<boolean> => {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  return hasHardware && isEnrolled;
};

export const isBiometricEnabled = async (): Promise<boolean> => {
  const value = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
  return value === "true";
};

export const setBiometricEnabled = async (enabled: boolean): Promise<void> => {
  if (enabled) {
    await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, "true");
  } else {
    await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
  }
};

export const getBiometricLabel = async (): Promise<{ label: string; icon: "scan" | "fingerprint" }> => {
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return {
      label: Platform.OS === "ios" ? "Face ID" : "face recognition",
      icon: "scan",
    };
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return {
      label: Platform.OS === "ios" ? "Touch ID" : "fingerprint",
      icon: "fingerprint",
    };
  }
  return { label: "biometrics", icon: "fingerprint" };
};

export const authenticate = async (): Promise<boolean> => {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: "Log in to Gumroad",
    cancelLabel: "Use password",
    disableDeviceFallback: true,
  });
  return result.success;
};
