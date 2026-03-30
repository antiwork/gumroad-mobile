import { render, screen, fireEvent } from "@testing-library/react-native";

const mockBack = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack }),
}));

import NotFoundScreen from "@/app/+not-found";

describe("NotFoundScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the not found message", () => {
    render(<NotFoundScreen />);
    expect(screen.getByText("Page not found")).toBeTruthy();
    expect(screen.getByText("The page you're looking for doesn't exist.")).toBeTruthy();
  });

  it("navigates back when the button is pressed", () => {
    render(<NotFoundScreen />);
    fireEvent.press(screen.getByText("Go back"));
    expect(mockBack).toHaveBeenCalled();
  });
});
