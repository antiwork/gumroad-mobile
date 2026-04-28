import { render, screen } from "@testing-library/react-native";
import { TextInput } from "react-native";

describe("TextInput smoke test", () => {
  it("renders without crashing", () => {
    render(<TextInput testID="text-input" placeholder="Enter text" />);
    expect(screen.getByTestId("text-input")).toBeTruthy();
  });

  it("renders with a value", () => {
    render(<TextInput testID="text-input" value="hello" />);
    expect(screen.getByDisplayValue("hello")).toBeTruthy();
  });

  it("renders multiline without crashing", () => {
    render(<TextInput testID="text-input" multiline placeholder="Enter text" />);
    expect(screen.getByTestId("text-input")).toBeTruthy();
  });
});
