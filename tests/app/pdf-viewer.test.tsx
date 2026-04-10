import { fireEvent, screen } from "@testing-library/react-native";
import { renderWithQueryClient } from "../render-with-query-client";

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ uri: "https://example.com/test.pdf", title: "Test PDF" }),
  Stack: { Screen: () => null },
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

jest.mock("@/modules/pdf-thumbnail", () => ({
  generateThumbnail: jest.fn().mockResolvedValue({ uri: "file:///thumb.jpg", width: 300, height: 420 }),
}));

let mockOnError: ((e: unknown) => void) | null = null;

jest.mock("react-native-pdf", () => {
  const { forwardRef } = require("react");
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: forwardRef((props: Record<string, unknown>, _ref: unknown) => {
      mockOnError = props.onError as any;
      return <View testID="pdf-component" />;
    }),
  };
});

import PdfViewerScreen from "@/app/pdf-viewer";
import { act } from "react";

const renderWithProviders = () => renderWithQueryClient(<PdfViewerScreen />);

describe("PdfViewerScreen", () => {
  beforeEach(() => {
    mockOnError = null;
  });

  it("shows error view with Try Again button when PDF fails to load", () => {
    renderWithProviders();

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
    renderWithProviders();

    act(() => {
      mockOnError!(new Error("ENOENT"));
    });

    fireEvent.press(screen.getByText("Try Again"));

    expect(screen.getByTestId("pdf-component")).toBeTruthy();
    expect(screen.queryByText("Try Again")).toBeNull();
  });
});
