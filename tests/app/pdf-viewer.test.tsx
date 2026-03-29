import { act, render } from "@testing-library/react-native";
import { AppState, Platform } from "react-native";

let appStateCallback: ((state: string) => void) | null = null;
const mockRemove = jest.fn();
jest.spyOn(AppState, "addEventListener").mockImplementation((_type, callback) => {
  appStateCallback = callback as (state: string) => void;
  return { remove: mockRemove } as ReturnType<typeof AppState.addEventListener>;
});

jest.mock("expo-navigation-bar", () => ({
  setVisibilityAsync: jest.fn(),
  setBehaviorAsync: jest.fn(),
}));

jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));

jest.mock("expo-file-system", () => ({
  File: { downloadFileAsync: jest.fn() },
  Paths: { cache: "/tmp" },
}));

jest.mock("expo-router", () => ({
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ uri: "https://example.com/test.pdf", title: "Test" }),
}));

jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ accessToken: "token" }),
}));

jest.mock("@/lib/media-location", () => ({
  updateMediaLocation: jest.fn(),
}));

jest.mock("@/components/use-ref-to-latest", () => ({
  useRefToLatest: (val: unknown) => ({ current: val }),
}));

jest.mock("@/components/icon", () => ({
  LineIcon: () => null,
  SolidIcon: () => null,
}));

jest.mock("@/components/ui/screen", () => ({
  Screen: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock("@/components/ui/sheet", () => ({
  Sheet: () => null,
  SheetContent: () => null,
  SheetHeader: () => null,
  SheetTitle: () => null,
}));

jest.mock("@/components/ui/text", () => ({
  Text: ({ children }: { children: React.ReactNode }) => children,
}));

const mockPdfComponent = jest.fn((_props: Record<string, unknown>) => null);
jest.mock("react-native-pdf", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
      mockPdfComponent(props);
      return null;
    }),
  };
});

import PdfViewerScreen from "@/app/pdf-viewer";

describe("PdfViewerScreen - background resume remount", () => {
  beforeEach(() => {
    appStateCallback = null;
    mockPdfComponent.mockClear();
    jest.clearAllMocks();
  });

  it("registers an AppState change listener", () => {
    Platform.OS = "android";
    render(<PdfViewerScreen />);
    expect(AppState.addEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });

  it("remounts Pdf component when Android app returns from background", () => {
    Platform.OS = "android";
    render(<PdfViewerScreen />);

    const renderCountBefore = mockPdfComponent.mock.calls.length;

    act(() => appStateCallback!("background"));
    act(() => appStateCallback!("active"));

    const renderCountAfter = mockPdfComponent.mock.calls.length;
    expect(renderCountAfter).toBeGreaterThan(renderCountBefore);
  });

  it("does not remount Pdf component on iOS when returning from background", () => {
    Platform.OS = "ios";
    render(<PdfViewerScreen />);

    const renderCountBefore = mockPdfComponent.mock.calls.length;

    act(() => appStateCallback!("background"));
    act(() => appStateCallback!("active"));

    const renderCountAfter = mockPdfComponent.mock.calls.length;
    expect(renderCountAfter).toBe(renderCountBefore);
  });

  it("cleans up AppState listener on unmount", () => {
    Platform.OS = "android";
    const { unmount } = render(<PdfViewerScreen />);
    unmount();
    expect(mockRemove).toHaveBeenCalled();
  });
});
