import { fireEvent, render, screen } from "@testing-library/react-native";

const mockBack = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack }),
}));

import { HeaderCloseButton } from "@/components/header-close-button";

describe("HeaderCloseButton", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("goes back when Close is pressed", () => {
    render(<HeaderCloseButton />);

    fireEvent.press(screen.getByLabelText("Close"));

    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
