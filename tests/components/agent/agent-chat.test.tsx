import { AgentChat } from "@/components/agent/agent-chat";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { act } from "react";
import { renderWithQueryClient } from "../../render-with-query-client";

jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ accessToken: "test-token" }),
}));

jest.mock("expo/fetch", () => ({ fetch: jest.fn() }));

const mockStreamAgentMessage = jest.fn();
const mockExecuteAgentAction = jest.fn();
jest.mock("@/lib/agent", () => ({
  ...jest.requireActual("@/lib/agent"),
  streamAgentMessage: (...args: unknown[]) => mockStreamAgentMessage(...args),
  executeAgentAction: (...args: unknown[]) => mockExecuteAgentAction(...args),
}));

const GREETING = "Hi! I'm your store assistant.";
const SUGGESTIONS = ["How are my sales doing?", "List my products"];

const renderChat = () => renderWithQueryClient(<AgentChat greeting={GREETING} suggestions={SUGGESTIONS} />);

describe("AgentChat", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the greeting and starter suggestions", () => {
    renderChat();

    expect(screen.getByText(GREETING)).toBeTruthy();
    expect(screen.getByText("How are my sales doing?")).toBeTruthy();
    expect(screen.getByText("List my products")).toBeTruthy();
  });

  it("sends a typed message and shows the assistant reply", async () => {
    mockStreamAgentMessage.mockResolvedValue({
      reply: "You have 3 products.",
      proposedAction: null,
      conversationId: "conv-123",
    });

    renderChat();

    fireEvent.changeText(screen.getByLabelText("Message"), "How many products do I have?");
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Send"));
    });

    await waitFor(() => expect(screen.getByText("You have 3 products.")).toBeTruthy());
    expect(mockStreamAgentMessage).toHaveBeenCalledWith({
      accessToken: "test-token",
      conversationId: null,
      handlers: { onToken: expect.any(Function), onReset: expect.any(Function) },
      messages: [
        { role: "assistant", content: GREETING },
        { role: "user", content: "How many products do I have?" },
      ],
    });
  });

  it("hides suggestions once a message is sent", async () => {
    mockStreamAgentMessage.mockResolvedValue({ reply: "Done.", proposedAction: null, conversationId: "conv-123" });

    renderChat();

    await act(async () => {
      fireEvent.press(screen.getByText("List my products"));
    });

    await waitFor(() => expect(screen.queryByText("How are my sales doing?")).toBeNull());
  });

  it("applies a proposed action when confirmed", async () => {
    mockStreamAgentMessage.mockResolvedValue({
      reply: "I've prepared a discount.",
      conversationId: "conv-123",
      proposedAction: {
        type: "create_discount",
        params: { code: "LAUNCH", percent_off: 20 },
        summary: "Create a 20% off code called LAUNCH",
      },
    });
    mockExecuteAgentAction.mockResolvedValue("Created discount LAUNCH.");

    renderChat();

    fireEvent.changeText(screen.getByLabelText("Message"), "Create a launch discount");
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Send"));
    });

    await waitFor(() => expect(screen.getByText("Create a 20% off code called LAUNCH")).toBeTruthy());

    await act(async () => {
      fireEvent.press(screen.getByText("Confirm"));
    });

    await waitFor(() => expect(screen.getByText("Applied")).toBeTruthy());
    expect(mockExecuteAgentAction).toHaveBeenCalledWith({
      accessToken: "test-token",
      conversationId: "conv-123",
      action: {
        type: "create_discount",
        params: { code: "LAUNCH", percent_off: 20 },
        summary: "Create a 20% off code called LAUNCH",
      },
    });
  });

  it("dismisses a proposed action without applying it", async () => {
    mockStreamAgentMessage.mockResolvedValue({
      reply: "I've prepared a discount.",
      conversationId: "conv-123",
      proposedAction: {
        type: "create_discount",
        params: { code: "LAUNCH", percent_off: 20 },
        summary: "Create a 20% off code called LAUNCH",
      },
    });

    renderChat();

    fireEvent.changeText(screen.getByLabelText("Message"), "Create a launch discount");
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Send"));
    });

    await waitFor(() => expect(screen.getByText("Create a 20% off code called LAUNCH")).toBeTruthy());

    await act(async () => {
      fireEvent.press(screen.getByText("Dismiss"));
    });

    await waitFor(() => expect(screen.getByText("Dismissed")).toBeTruthy());
    expect(mockExecuteAgentAction).not.toHaveBeenCalled();
  });

  it("renders the action title and structured fields when provided", async () => {
    mockStreamAgentMessage.mockResolvedValue({
      reply: "I've prepared a discount.",
      conversationId: "conv-123",
      proposedAction: {
        type: "create_discount",
        params: { code: "LAUNCH", percent_off: 20 },
        summary: "Create a 20% off code called LAUNCH",
        title: "Create discount",
        fields: [
          { label: "Code", value: "LAUNCH" },
          { label: "Discount", value: "20% off" },
        ],
      },
    });

    renderChat();

    fireEvent.changeText(screen.getByLabelText("Message"), "Create a launch discount");
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Send"));
    });

    await waitFor(() => expect(screen.getByText("Create discount")).toBeTruthy());
    expect(screen.getByText("Code")).toBeTruthy();
    expect(screen.getByText("LAUNCH")).toBeTruthy();
    expect(screen.getByText("Discount")).toBeTruthy();
    expect(screen.getByText("20% off")).toBeTruthy();
    expect(screen.queryByText("Create a 20% off code called LAUNCH")).toBeNull();
  });

  it("shows a fallback assistant message when the request fails", async () => {
    mockStreamAgentMessage.mockRejectedValue(new Error("network down"));

    renderChat();

    fireEvent.changeText(screen.getByLabelText("Message"), "How are sales?");
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Send"));
    });

    await waitFor(() => expect(screen.getByText("Sorry, I ran into a problem. Please try again.")).toBeTruthy());
  });

  it("shows an error message when applying a confirmed action fails", async () => {
    mockStreamAgentMessage.mockResolvedValue({
      reply: "I've prepared a discount.",
      conversationId: "conv-123",
      proposedAction: {
        type: "create_discount",
        params: { code: "LAUNCH", percent_off: 20 },
        summary: "Create a 20% off code called LAUNCH",
      },
    });
    mockExecuteAgentAction.mockRejectedValue(new Error("Product was deleted"));

    renderChat();

    fireEvent.changeText(screen.getByLabelText("Message"), "Create a launch discount");
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Send"));
    });

    await waitFor(() => expect(screen.getByText("Create a 20% off code called LAUNCH")).toBeTruthy());

    await act(async () => {
      fireEvent.press(screen.getByText("Confirm"));
    });

    await waitFor(() =>
      expect(screen.getByText("Sorry, I couldn't apply that change. Please try again.")).toBeTruthy(),
    );
    expect(screen.queryByText("Applied")).toBeNull();
  });
});
