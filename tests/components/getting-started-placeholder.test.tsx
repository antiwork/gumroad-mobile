import { fireEvent, render, screen } from "@testing-library/react-native";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

import { GettingStartedPlaceholder } from "@/components/getting-started-placeholder";

describe("GettingStartedPlaceholder", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows the headline and the passed message", () => {
    render(<GettingStartedPlaceholder message="Create your first product and your sales will show up here." />);

    expect(screen.getByText("You're just getting started.")).toBeTruthy();
    expect(screen.getByText("Create your first product and your sales will show up here.")).toBeTruthy();
  });

  it("opens the in-app create-product screen instead of an external browser", () => {
    render(<GettingStartedPlaceholder message="msg" />);

    fireEvent.press(screen.getByText("Create your first product"));

    expect(mockPush).toHaveBeenCalledWith("/create-product");
  });
});
