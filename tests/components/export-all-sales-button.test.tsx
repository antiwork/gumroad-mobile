import { ExportAllSalesButton } from "@/components/export-all-sales-button";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { Alert as NativeAlert } from "react-native";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

describe("ExportAllSalesButton", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows confirmation before opening the in-app export page", () => {
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

    expect(mockPush).toHaveBeenCalledWith("/sales-export");
  });
});
