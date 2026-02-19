import { fireEvent, render, screen } from "@testing-library/react-native";
import { act } from "react";

jest.mock("react-native-webview", () => ({ WebView: "WebView" }));

const mockLogin = jest.fn();
jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    isAuthenticated: false,
    isLoading: false,
    login: mockLogin,
  }),
}));

jest.mock("expo-router", () => ({
  Redirect: () => null,
}));

jest.mock("expo-web-browser", () => ({
  openBrowserAsync: jest.fn(),
}));

jest.mock("uniwind", () => ({
  useUniwind: () => ({ theme: "light" }),
  useCSSVariable: () => "#8a8a8a",
  withUniwind: (component: unknown) => component,
}));

import LoginScreen from "@/app/login";

describe("LoginScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLogin.mockResolvedValue(undefined);
  });

  it("renders email and password inputs", () => {
    render(<LoginScreen />);
    expect(screen.getByPlaceholderText("Email")).toBeTruthy();
    expect(screen.getByPlaceholderText("Password")).toBeTruthy();
  });

  it("renders the login button", () => {
    render(<LoginScreen />);
    expect(screen.getByText("Log in")).toBeTruthy();
  });

  it("calls login with email and password on submit", async () => {
    render(<LoginScreen />);
    fireEvent.changeText(screen.getByPlaceholderText("Email"), "user@example.com");
    fireEvent.changeText(screen.getByPlaceholderText("Password"), "password123");
    await act(async () => {
      fireEvent.press(screen.getByText("Log in"));
    });
    expect(mockLogin).toHaveBeenCalledWith("user@example.com", "password123");
  });

  it("does not call login when email is empty", async () => {
    render(<LoginScreen />);
    fireEvent.changeText(screen.getByPlaceholderText("Password"), "password123");
    await act(async () => {
      fireEvent.press(screen.getByText("Log in"));
    });
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it("does not call login when password is empty", async () => {
    render(<LoginScreen />);
    fireEvent.changeText(screen.getByPlaceholderText("Email"), "user@example.com");
    await act(async () => {
      fireEvent.press(screen.getByText("Log in"));
    });
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it("displays error message when login fails", async () => {
    mockLogin.mockRejectedValue(new Error("Invalid email or password"));
    render(<LoginScreen />);
    fireEvent.changeText(screen.getByPlaceholderText("Email"), "user@example.com");
    fireEvent.changeText(screen.getByPlaceholderText("Password"), "wrong");
    await act(async () => {
      fireEvent.press(screen.getByText("Log in"));
    });
    expect(screen.getByText("Invalid email or password")).toBeTruthy();
  });

  it("clears error on next submission attempt", async () => {
    mockLogin.mockRejectedValueOnce(new Error("Invalid email or password")).mockResolvedValueOnce(undefined);
    render(<LoginScreen />);
    fireEvent.changeText(screen.getByPlaceholderText("Email"), "user@example.com");
    fireEvent.changeText(screen.getByPlaceholderText("Password"), "wrong");
    await act(async () => {
      fireEvent.press(screen.getByText("Log in"));
    });
    expect(screen.getByText("Invalid email or password")).toBeTruthy();

    fireEvent.changeText(screen.getByPlaceholderText("Password"), "correct");
    await act(async () => {
      fireEvent.press(screen.getByText("Log in"));
    });
    expect(screen.queryByText("Invalid email or password")).toBeNull();
  });

  it("opens forgot password page in browser", () => {
    const WebBrowser = require("expo-web-browser");
    render(<LoginScreen />);
    fireEvent.press(screen.getByText("Forgot password?"));
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(expect.stringContaining("/forgot_password"));
  });

  it("trims whitespace from email before login", async () => {
    render(<LoginScreen />);
    fireEvent.changeText(screen.getByPlaceholderText("Email"), "  user@example.com  ");
    fireEvent.changeText(screen.getByPlaceholderText("Password"), "password");
    await act(async () => {
      fireEvent.press(screen.getByText("Log in"));
    });
    expect(mockLogin).toHaveBeenCalledWith("user@example.com", "password");
  });
});
