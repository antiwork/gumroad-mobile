import { Alert, Linking } from "react-native";
import { safeOpenURL } from "@/lib/open-url";

jest.spyOn(Alert, "alert");
jest.spyOn(Linking, "canOpenURL");
jest.spyOn(Linking, "openURL");

const mockCanOpenURL = Linking.canOpenURL as jest.Mock;
const mockOpenURL = Linking.openURL as jest.Mock;
const mockAlert = Alert.alert as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockOpenURL.mockResolvedValue(true);
});

describe("safeOpenURL", () => {
  it("opens the URL when a browser is available", async () => {
    mockCanOpenURL.mockResolvedValue(true);

    const result = await safeOpenURL("https://example.com");

    expect(result).toBe(true);
    expect(Linking.openURL).toHaveBeenCalledWith("https://example.com");
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it("shows an alert and does not open the URL when no browser is available", async () => {
    mockCanOpenURL.mockResolvedValue(false);

    const result = await safeOpenURL("https://example.com");

    expect(result).toBe(false);
    expect(Linking.openURL).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith("No browser found", "Please install a web browser to continue.");
  });

  it("shows an alert when canOpenURL throws", async () => {
    mockCanOpenURL.mockRejectedValue(new Error("fail"));

    const result = await safeOpenURL("https://example.com");

    expect(result).toBe(false);
    expect(Alert.alert).toHaveBeenCalledWith("No browser found", "Please install a web browser to continue.");
  });

  it("shows an alert when openURL throws", async () => {
    mockCanOpenURL.mockResolvedValue(true);
    mockOpenURL.mockRejectedValue(new Error("ActivityNotFoundException"));

    const result = await safeOpenURL("https://example.com");

    expect(result).toBe(false);
    expect(Alert.alert).toHaveBeenCalledWith("No browser found", "Please install a web browser to continue.");
  });
});
