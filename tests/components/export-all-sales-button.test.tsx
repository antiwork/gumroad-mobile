import { ExportAllSalesButton, getExportAllSalesUrl } from "@/components/export-all-sales-button";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { Alert as NativeAlert } from "react-native";

const mockSafeOpenURL = jest.fn();

jest.mock("@/lib/open-url", () => ({
  safeOpenURL: (url: string) => mockSafeOpenURL(url),
}));

describe("getExportAllSalesUrl", () => {
  it("points to the web sales export", () => {
    expect(getExportAllSalesUrl()).toBe("https://example.com/purchases/export");
  });
});

describe("ExportAllSalesButton", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows confirmation before opening the export page", () => {
    jest.spyOn(NativeAlert, "alert");
    render(<ExportAllSalesButton />);

    fireEvent.press(screen.getByText("Export all sales"));

    expect(NativeAlert.alert).toHaveBeenCalledWith(
      "Export all sales",
      "You'll get a CSV of every sale you've made. Large exports arrive by email.",
      expect.any(Array),
    );

    const buttons = (NativeAlert.alert as jest.Mock).mock.calls[0][2] as { text: string; onPress?: () => void }[];
    buttons.find((button) => button.text === "Export")?.onPress?.();

    expect(mockSafeOpenURL).toHaveBeenCalledWith("https://example.com/purchases/export");
  });
});
