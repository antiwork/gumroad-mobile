import { fireEvent, render, screen } from "@testing-library/react-native";

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ uri: "https://example.com/test.pdf", title: "Test PDF" }),
  Stack: { Screen: () => null },
}));

jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));

jest.mock("expo-file-system", () => ({
  File: { downloadFileAsync: jest.fn() },
  Paths: { cache: "/cache" },
}));

jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ accessToken: "test-token" }),
}));

jest.mock("@/lib/media-location", () => ({
  updateMediaLocation: jest.fn(),
}));

let mockOnError: ((e: unknown) => void) | null = null;
let mockOnPageChanged: ((page: number) => void) | null = null;
let lastPdfProps: Record<string, unknown> = {};

jest.mock("react-native-pdf", () => {
  const { forwardRef } = require("react");
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: forwardRef((props: Record<string, unknown>, _ref: unknown) => {
      mockOnError = props.onError as any;
      mockOnPageChanged = props.onPageChanged as any;
      lastPdfProps = props;
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
    mockOnPageChanged = null;
    lastPdfProps = {};
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

  it("temporarily disables scroll after page change in single-page mode", () => {
    render(<PdfViewerScreen />);

    expect(lastPdfProps.scrollEnabled).toBe(true);
    expect(lastPdfProps.enablePaging).toBe(true);

    act(() => {
      mockOnPageChanged!(2);
    });

    // Scroll should be locked immediately after page change
    expect(lastPdfProps.scrollEnabled).toBe(false);

    act(() => {
      jest.advanceTimersByTime(350);
    });

    // Scroll should be re-enabled after the cooldown
    expect(lastPdfProps.scrollEnabled).toBe(true);
  });
});
