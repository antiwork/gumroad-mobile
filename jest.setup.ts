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

jest.mock("react-native-reanimated", () => {
  const View = require("react-native").View;
  return {
    __esModule: true,
    default: {
      createAnimatedComponent: (component: unknown) => component,
      View,
      Text: View,
      Image: View,
      ScrollView: View,
      FlatList: View,
    },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: (fn: () => unknown) => fn(),
    withTiming: (v: unknown) => v,
    withSpring: (v: unknown) => v,
    withRepeat: (v: unknown) => v,
    cancelAnimation: jest.fn(),
    withSequence: (...args: unknown[]) => args[0],
    withDelay: (_: unknown, v: unknown) => v,
    Easing: { inOut: jest.fn(), in: jest.fn(), out: jest.fn(), bezier: jest.fn() },
    FadeIn: { duration: jest.fn().mockReturnThis() },
    FadeOut: { duration: jest.fn().mockReturnThis() },
    SlideInDown: { duration: jest.fn().mockReturnThis() },
    SlideOutDown: { duration: jest.fn().mockReturnThis() },
    Layout: { duration: jest.fn().mockReturnThis() },
    runOnJS: (fn: unknown) => fn,
    runOnUI: (fn: unknown) => fn,
    interpolate: jest.fn(),
    Extrapolation: { CLAMP: "clamp" },
    useAnimatedScrollHandler: jest.fn(),
    useDerivedValue: (fn: () => unknown) => ({ value: fn() }),
    createAnimatedComponent: (component: unknown) => component,
  };
});

jest.mock("@expo/vector-icons/build/createIconSet", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return () => (props: Record<string, unknown>) => React.createElement(Text, props);
});
