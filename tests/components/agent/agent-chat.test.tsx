import { AgentChat } from "@/components/agent/agent-chat";
import { LineIcon } from "@/components/icon";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { act } from "react";
import { KeyboardAvoidingView, Platform } from "react-native";
import { renderWithQueryClient } from "../../render-with-query-client";

jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ accessToken: "test-token" }),
}));

jest.mock("@react-navigation/elements", () => ({
  ...jest.requireActual("@react-navigation/elements"),
  useHeaderHeight: () => 104,
}));

jest.mock("expo/fetch", () => ({ fetch: jest.fn() }));

const mockStreamAgentMessage = jest.fn();
const mockExecuteAgentAction = jest.fn();
const mockFetchLatestAgentConversation = jest.fn();
jest.mock("@/lib/agent", () => ({
  ...jest.requireActual("@/lib/agent"),
  streamAgentMessage: (...args: unknown[]) => mockStreamAgentMessage(...args),
  executeAgentAction: (...args: unknown[]) => mockExecuteAgentAction(...args),
  fetchLatestAgentConversation: (...args: unknown[]) => mockFetchLatestAgentConversation(...args),
}));

const GREETING = "Hi! I'm your store assistant.";
const SUGGESTIONS = ["How are my sales doing?", "List my products"];

const renderChat = () => renderWithQueryClient(<AgentChat greeting={GREETING} suggestions={SUGGESTIONS} />);

describe("AgentChat", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchLatestAgentConversation.mockResolvedValue(null);
  });

  it("renders the greeting and starter suggestions", () => {
    renderChat();

    expect(screen.getByText(GREETING)).toBeTruthy();
    expect(screen.getByText("How are my sales doing?")).toBeTruthy();
    expect(screen.getByText("List my products")).toBeTruthy();
    expect(screen.getByTestId("suggested-actions").props.className).toContain("pb-1");
  });

  it("keeps the disabled send icon visible and uses the accent color for typed text", () => {
    renderChat();

    expect(screen.UNSAFE_getByType(LineIcon).props.className).toBe("text-primary-foreground");
    fireEvent.changeText(screen.getByLabelText("Message"), "Hello");
    expect(screen.UNSAFE_getByType(LineIcon).props.className).toBe("text-accent-foreground");
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
        type: "api_write",
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
        type: "api_write",
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
        type: "api_write",
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
        type: "api_write",
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
        type: "api_write",
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

  it("renders streamed tokens in the footer, drops them on reset, and commits the final reply", async () => {
    let resolveTurn!: (result: { reply: string; proposedAction: null; conversationId: string }) => void;
    mockStreamAgentMessage.mockImplementation(
      ({ handlers }: { handlers: { onToken: (text: string) => void; onReset: () => void } }) =>
        new Promise((resolve) => {
          resolveTurn = resolve;
          handlers.onToken("Checking your ");
          handlers.onToken("store...");
        }),
    );

    renderChat();

    fireEvent.changeText(screen.getByLabelText("Message"), "How are sales?");
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Send"));
    });

    await waitFor(() => expect(screen.getByText("Checking your store...")).toBeTruthy());
    expect(screen.queryByText("Working on it...")).toBeNull();

    const { handlers } = mockStreamAgentMessage.mock.calls[0][0] as {
      handlers: { onToken: (text: string) => void; onReset: () => void };
    };
    await act(async () => {
      handlers.onReset();
    });
    expect(screen.queryByText("Checking your store...")).toBeNull();
    expect(screen.getByText("Working on it...")).toBeTruthy();

    await act(async () => {
      handlers.onToken("Sales are ");
      handlers.onToken("up 20%.");
    });
    await waitFor(() => expect(screen.getByText("Sales are up 20%.")).toBeTruthy());

    await act(async () => {
      resolveTurn({ reply: "Sales are up 20% this week.", proposedAction: null, conversationId: "conv-123" });
    });
    await waitFor(() => expect(screen.getByText("Sales are up 20% this week.")).toBeTruthy());
    expect(screen.queryByText("Sales are up 20%.")).toBeNull();
  });

  it("resumes the latest stored conversation on open and continues it", async () => {
    mockFetchLatestAgentConversation.mockResolvedValue({
      id: "conv-resumed",
      title: "Sales check",
      messages: [
        { role: "user", content: "How are sales?" },
        { role: "assistant", content: "Sales are up 20% this week." },
      ],
    });
    mockStreamAgentMessage.mockResolvedValue({
      reply: "You have 3 products.",
      proposedAction: null,
      conversationId: "conv-resumed",
    });

    renderChat();

    await waitFor(() => expect(screen.getByText("Sales are up 20% this week.")).toBeTruthy());
    expect(screen.getByText("How are sales?")).toBeTruthy();
    expect(screen.queryByText("How are my sales doing?")).toBeNull();

    fireEvent.changeText(screen.getByLabelText("Message"), "How many products do I have?");
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Send"));
    });

    await waitFor(() =>
      expect(mockStreamAgentMessage).toHaveBeenCalledWith(expect.objectContaining({ conversationId: "conv-resumed" })),
    );
  });

  it("renders a resumed unconfirmed proposal as dismissed", async () => {
    mockFetchLatestAgentConversation.mockResolvedValue({
      id: "conv-resumed",
      title: "Discount",
      messages: [
        { role: "user", content: "Create a launch discount" },
        {
          role: "assistant",
          content: "I've prepared a discount.",
          proposed_action: {
            type: "api_write",
            params: { code: "LAUNCH" },
            summary: "Create a 20% off code called LAUNCH",
          },
        },
      ],
    });

    renderChat();

    await waitFor(() => expect(screen.getByText("Dismissed")).toBeTruthy());
    expect(screen.queryByText("Confirm")).toBeNull();
  });

  it("starts a fresh chat when fetching the latest conversation fails", async () => {
    mockFetchLatestAgentConversation.mockRejectedValue(new Error("network down"));

    renderChat();

    await waitFor(() => expect(mockFetchLatestAgentConversation).toHaveBeenCalled());
    expect(screen.getByText(GREETING)).toBeTruthy();
    expect(screen.getByText("How are my sales doing?")).toBeTruthy();
  });

  it("keeps keyboard avoidance active on Android", () => {
    const originalOS = Platform.OS;
    Platform.OS = "android";
    try {
      renderChat();
      const keyboardAvoidingView = screen.UNSAFE_getByType(KeyboardAvoidingView);
      expect(keyboardAvoidingView.props.behavior).toBe("padding");
      expect(keyboardAvoidingView.props.keyboardVerticalOffset).toBe(104);
    } finally {
      Platform.OS = originalOS;
    }
  });

  it("offsets keyboard avoidance below the header on iOS", () => {
    renderChat();
    const keyboardAvoidingView = screen.UNSAFE_getByType(KeyboardAvoidingView);
    expect(keyboardAvoidingView.props.behavior).toBe("padding");
    expect(keyboardAvoidingView.props.keyboardVerticalOffset).toBe(88);
  });
});
