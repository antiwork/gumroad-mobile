import { fireEvent, render, screen } from "@testing-library/react-native";

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ uri: "https://example.com/test.pdf", title: "Test PDF" }),
  Stack: {
    Screen: ({ options }: any) => {
      const { View } = require("react-native");
      const headerRight = options?.headerRight?.();
      return <View testID="stack-screen">{headerRight}</View>;
    },
  },
}));

jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));

jest.mock("expo-file-system", () => ({
  File: { downloadFileAsync: jest.fn().mockResolvedValue({ uri: "file:///cache/test.pdf" }) },
  Paths: { cache: "/cache" },
}));

jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ accessToken: "test-token" }),
}));

jest.mock("@/lib/media-location", () => ({
  updateMediaLocation: jest.fn(),
}));

jest.mock("@/components/ui/sheet", () => {
  const { View, Text } = require("react-native");
  return {
    Sheet: ({ children, open }: any) => (open ? <View>{children}</View> : null),
    SheetContent: ({ children }: any) => <View>{children}</View>,
    SheetHeader: ({ children }: any) => <View>{children}</View>,
    SheetTitle: ({ children }: any) => <Text>{children}</Text>,
  };
});

let mockOnError: ((e: unknown) => void) | null = null;
let mockPdfProps: Record<string, unknown> | null = null;

jest.mock("react-native-pdf", () => {
  const { forwardRef } = require("react");
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: forwardRef((props: Record<string, unknown>, _ref: unknown) => {
      mockOnError = props.onError as any;
      mockPdfProps = props;
      return <View testID="pdf-component" />;
    }),
  };
});

import PdfViewerScreen from "@/app/pdf-viewer";
import { act } from "react";

describe("PdfViewerScreen", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockOnError = null;
    mockPdfProps = null;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("shows error view with Try Again button when PDF fails to load", () => {
    render(<PdfViewerScreen />);

    expect(screen.getByTestId("pdf-component")).toBeTruthy();
    expect(screen.queryByText("Try Again")).toBeNull();

    act(() => {
      mockOnError!(new Error("open failed: ENOENT (No such file or directory)"));
    });

    expect(screen.getByText("Try Again")).toBeTruthy();
    expect(screen.getByText(/Unable to load this PDF/)).toBeTruthy();
    expect(screen.queryByTestId("pdf-component")).toBeNull();
  });

  it("re-mounts PDF component when Try Again is pressed", () => {
    render(<PdfViewerScreen />);

    act(() => {
      mockOnError!(new Error("ENOENT"));
    });

    fireEvent.press(screen.getByText("Try Again"));

    expect(screen.getByTestId("pdf-component")).toBeTruthy();
    expect(screen.queryByText("Try Again")).toBeNull();
  });

  it("unmounts PDF and remounts after a delay when switching view mode", () => {
    render(<PdfViewerScreen />);

    expect(screen.getByTestId("pdf-component")).toBeTruthy();

    // Open the view mode sheet
    fireEvent.press(screen.getByTestId("view-mode-button"));

    // Now "Continuous" option should be visible in the sheet
    fireEvent.press(screen.getByText("Continuous"));

    // PDF should be unmounted immediately during the switch
    expect(screen.queryByTestId("pdf-component")).toBeNull();

    // PDF should not remount until the timeout fires
    act(() => {
      jest.advanceTimersByTime(50);
    });
    expect(screen.queryByTestId("pdf-component")).toBeNull();

    // After 100ms, PDF should remount
    act(() => {
      jest.advanceTimersByTime(50);
    });
    expect(screen.getByTestId("pdf-component")).toBeTruthy();
  });
});
