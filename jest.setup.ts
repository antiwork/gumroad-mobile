process.env.EXPO_PUBLIC_GUMROAD_URL = "https://example.com";
process.env.EXPO_PUBLIC_GUMROAD_API_URL = "https://api.example.com";
process.env.EXPO_PUBLIC_GUMROAD_CLIENT_ID = "test-client-id";
process.env.EXPO_PUBLIC_MOBILE_TOKEN = "test-mobile-token";
process.env.EXPO_PUBLIC_SENTRY_DSN = "https://test@sentry.io/123";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock("@sentry/react-native", () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  setUser: jest.fn(),
  withScope: jest.fn(),
  addBreadcrumb: jest.fn(),
  Severity: {},
}));

jest.mock("@expo/vector-icons/build/createIconSet", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return () => (props: Record<string, unknown>) => React.createElement(Text, props);
});
