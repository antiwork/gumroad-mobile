import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { renderWithQueryClient } from "../render-with-query-client";

type MockSearchParams = {
  uri: string;
  title?: string;
  fileName?: string;
  productFileId?: string;
};

const defaultSearchParams: MockSearchParams = {
  uri: "https://example.com/test.pdf",
  title: "Test PDF",
  fileName: "HOW TO BECOME AN ELITE PLAYER AND BE BETTER THAN 99%.pdf",
  productFileId: "pf1",
};
let mockSearchParams: MockSearchParams = { ...defaultSearchParams };

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockSearchParams,
  Stack: {
    Screen: ({ options }: { options?: { headerRight?: () => React.ReactNode } }) => {
      const React = require("react");
      return React.createElement(React.Fragment, null, options?.headerRight?.());
    },
  },
}));

jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));

jest.mock("expo-file-system", () => {
  const Paths = { cache: "/cache" };
  class Directory {
    uri: string;
    exists = true;
    constructor(parent: string | { uri: string }, name: string) {
      const base = typeof parent === "string" ? parent : parent.uri;
      this.uri = `${base}/${name}`;
    }
    create() {}
  }
  class File {
    name: string;
    uri: string;
    static downloadFileAsync = jest.fn().mockResolvedValue({ uri: "file:///cache/test.pdf" });
    constructor(parent: string | { uri: string }, name?: string) {
      const base = typeof parent === "string" ? parent : parent.uri;
      this.name = name ?? "";
      this.uri = name === undefined ? base : `${base}/${name}`;
    }
  }
  return { Directory, File, Paths };
});

jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ accessToken: "test-token" }),
}));

jest.mock("@/lib/media-location", () => ({
  updateMediaLocation: jest.fn(),
}));

jest.mock("@/modules/pdf-thumbnail", () => ({
  generateThumbnail: jest.fn().mockResolvedValue({ uri: "file:///thumb.jpg", width: 300, height: 420 }),
}));

jest.mock("@/components/pdf-navigation-sheet", () => ({
  PdfNavigationSheet: () => null,
}));

let mockOnError: ((e: unknown) => void) | null = null;

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
};

const deferred = <T,>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
};

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
    const { File } = require("expo-file-system");
    const Sharing = require("expo-sharing");
    mockSearchParams = { ...defaultSearchParams };
    mockOnError = null;
    File.downloadFileAsync.mockReset();
    File.downloadFileAsync.mockResolvedValue({ uri: "file:///cache/test.pdf" });
    Sharing.isAvailableAsync.mockReset();
    Sharing.shareAsync.mockReset();
    Sharing.isAvailableAsync.mockResolvedValue(true);
  });

  it("shows error view with Try Again button when PDF fails to load", async () => {
    renderWithProviders();

    // Flushing microtasks is deterministic; polling with waitFor times out on slow CI runners.
    await act(async () => {});
    expect(screen.getByTestId("pdf-component")).toBeTruthy();
    expect(screen.queryByText("Try Again")).toBeNull();

    act(() => {
      mockOnError!(new Error("open failed: ENOENT (No such file or directory)"));
    });

    expect(screen.getByText("Try Again")).toBeTruthy();
    expect(screen.getByText(/Unable to load this PDF/)).toBeTruthy();
    expect(screen.queryByTestId("pdf-component")).toBeNull();
  });

  it("re-mounts PDF component when Try Again is pressed", async () => {
    renderWithProviders();

    await act(async () => {});
    expect(screen.getByTestId("pdf-component")).toBeTruthy();

    act(() => {
      mockOnError!(new Error("ENOENT"));
    });

    fireEvent.press(screen.getByText("Try Again"));

    await act(async () => {});
    expect(screen.getByTestId("pdf-component")).toBeTruthy();
    expect(screen.queryByText("Try Again")).toBeNull();
  });

  it("shows loading spinner while downloading PDF", () => {
    const { File } = require("expo-file-system");
    File.downloadFileAsync.mockReturnValueOnce(new Promise(() => {}));

    renderWithProviders();

    expect(screen.getByTestId("loading-spinner")).toBeTruthy();
    expect(screen.queryByTestId("pdf-component")).toBeNull();
  });

  it("shows error view when PDF download fails", async () => {
    const { File } = require("expo-file-system");
    File.downloadFileAsync.mockRejectedValueOnce(new Error("Network error"));

    renderWithProviders();

    await waitFor(() => expect(screen.getByText("Try Again")).toBeTruthy());
    expect(screen.getByText(/Unable to load this PDF/)).toBeTruthy();
    expect(screen.queryByTestId("pdf-component")).toBeNull();
  });

  it("ignores stale retry failures after a newer retry succeeds", async () => {
    const { File } = require("expo-file-system");
    const slowFailure = deferred<{ uri: string }>();
    const fastSuccess = deferred<{ uri: string }>();
    File.downloadFileAsync
      .mockRejectedValueOnce(new Error("Initial network error"))
      .mockReturnValueOnce(slowFailure.promise)
      .mockReturnValueOnce(fastSuccess.promise);

    renderWithProviders();

    await waitFor(() => expect(screen.getByText("Try Again")).toBeTruthy());
    const retryButton = screen.getByText("Try Again");

    act(() => {
      fireEvent.press(retryButton);
      fireEvent.press(retryButton);
    });

    expect(File.downloadFileAsync).toHaveBeenCalledTimes(3);

    await act(async () => {
      fastSuccess.resolve({ uri: "file:///cache/fast.pdf" });
    });

    await waitFor(() => expect(screen.getByTestId("pdf-component")).toBeTruthy());

    await act(async () => {
      slowFailure.reject(new Error("Stale retry failure"));
    });

    expect(screen.queryByText(/Unable to load this PDF/)).toBeNull();
    expect(screen.getByTestId("pdf-component")).toBeTruthy();
  });

  it("downloads to a sanitized cache destination so PDFs with special characters in the name load", async () => {
    const { File } = require("expo-file-system");

    renderWithProviders();

    await waitFor(() => expect(screen.getByTestId("pdf-component")).toBeTruthy());

    const destination = File.downloadFileAsync.mock.calls[0][1];
    expect(destination.uri).toBe("/cache/pf1/HOW TO BECOME AN ELITE PLAYER AND BE BETTER THAN 99_.pdf");
    expect(destination.uri).not.toContain("%");
  });

  it("downloads to a sanitized fallback cache destination when product file id is missing", async () => {
    const { File } = require("expo-file-system");
    mockSearchParams = {
      uri: "https://example.com/test.pdf",
      title: "Test PDF",
      fileName: "100% bonus #1.pdf",
    };

    renderWithProviders();

    await waitFor(() => expect(screen.getByTestId("pdf-component")).toBeTruthy());

    const destination = File.downloadFileAsync.mock.calls[0][1];
    expect(destination.uri).toBe("/cache/pdf-viewer/100_ bonus _1.pdf");
    expect(destination.uri).not.toContain("%");
    expect(destination.uri).not.toContain("#");
  });

  it("shares the cached PDF file when available", async () => {
    const { File } = require("expo-file-system");
    const Sharing = require("expo-sharing");

    renderWithProviders();

    await waitFor(() => expect(screen.getByTestId("pdf-component")).toBeTruthy());

    fireEvent.press(screen.getByTestId("share-pdf-button"));

    await waitFor(() => expect(Sharing.shareAsync).toHaveBeenCalledWith("file:///cache/test.pdf"));
    expect(File.downloadFileAsync).toHaveBeenCalledTimes(1);
  });
});
