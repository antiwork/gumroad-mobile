import { useWebViewMessage } from "@/components/use-webview-message";
import { renderHook } from "@testing-library/react-native";
import type { WebViewMessageEvent } from "react-native-webview";

const makeEvent = (data: string): WebViewMessageEvent =>
  ({ nativeEvent: { data } } as WebViewMessageEvent);

describe("useWebViewMessage", () => {
  const clickHandler = jest.fn();
  const tocHandler = jest.fn();

  const handlers = [
    { type: "click", handler: clickHandler },
    { type: "tocData", handler: tocHandler },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("dispatches to the correct handler based on message type", async () => {
    const { result } = renderHook(() => useWebViewMessage(handlers));
    await result.current(makeEvent(JSON.stringify({ type: "click", payload: { resourceId: "abc" } })));
    expect(clickHandler).toHaveBeenCalledWith({ resourceId: "abc" });
    expect(tocHandler).not.toHaveBeenCalled();
  });

  it("dispatches tocData messages to the toc handler", async () => {
    const { result } = renderHook(() => useWebViewMessage(handlers));
    const payload = { pages: [{ page_id: "p1", title: "Intro" }], activePageIndex: 0 };
    await result.current(makeEvent(JSON.stringify({ type: "tocData", payload })));
    expect(tocHandler).toHaveBeenCalledWith(payload);
    expect(clickHandler).not.toHaveBeenCalled();
  });

  it("ignores messages with invalid JSON", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation();
    const { result } = renderHook(() => useWebViewMessage(handlers));
    await result.current(makeEvent("not json"));
    expect(clickHandler).not.toHaveBeenCalled();
    expect(tocHandler).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("ignores messages with unknown types", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation();
    const { result } = renderHook(() => useWebViewMessage(handlers));
    await result.current(makeEvent(JSON.stringify({ type: "unknown", payload: {} })));
    expect(clickHandler).not.toHaveBeenCalled();
    expect(tocHandler).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("ignores messages without a type field", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation();
    const { result } = renderHook(() => useWebViewMessage(handlers));
    await result.current(makeEvent(JSON.stringify({ payload: {} })));
    expect(clickHandler).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
