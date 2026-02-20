import { renderHook, act } from "@testing-library/react-native";
import { useTableOfContents } from "@/components/use-table-of-contents";

const mockPostMessage = jest.fn();
const mockWebViewRef = { current: { postMessage: mockPostMessage } } as any;

beforeEach(() => {
  mockPostMessage.mockClear();
});

describe("useTableOfContents", () => {
  it("initializes with empty pages", () => {
    const { result } = renderHook(() => useTableOfContents(mockWebViewRef));
    expect(result.current.pages).toEqual([]);
    expect(result.current.currentPageIndex).toBe(0);
  });

  it("handles tocPages message", () => {
    const { result } = renderHook(() => useTableOfContents(mockWebViewRef));
    const pages = [
      { id: "p1", name: "Page 1" },
      { id: "p2", name: "Page 2" },
    ];

    act(() => {
      const handled = result.current.handleTocMessage(
        JSON.stringify({ type: "tocPages", payload: { pages, currentPageIndex: 1 } }),
      );
      expect(handled).toBe(true);
    });

    expect(result.current.pages).toEqual(pages);
    expect(result.current.currentPageIndex).toBe(1);
  });

  it("handles tocPageChanged message", () => {
    const { result } = renderHook(() => useTableOfContents(mockWebViewRef));

    // First set pages
    act(() => {
      result.current.handleTocMessage(
        JSON.stringify({
          type: "tocPages",
          payload: { pages: [{ id: "p1", name: "Page 1" }, { id: "p2", name: "Page 2" }], currentPageIndex: 0 },
        }),
      );
    });

    act(() => {
      const handled = result.current.handleTocMessage(
        JSON.stringify({ type: "tocPageChanged", payload: { currentPageIndex: 1 } }),
      );
      expect(handled).toBe(true);
    });

    expect(result.current.currentPageIndex).toBe(1);
  });

  it("returns false for non-TOC messages", () => {
    const { result } = renderHook(() => useTableOfContents(mockWebViewRef));
    act(() => {
      const handled = result.current.handleTocMessage(JSON.stringify({ type: "click", payload: {} }));
      expect(handled).toBe(false);
    });
  });

  it("sends navigate message to WebView", () => {
    const { result } = renderHook(() => useTableOfContents(mockWebViewRef));
    const pages = [
      { id: "p1", name: "Page 1" },
      { id: "p2", name: "Page 2" },
    ];

    act(() => {
      result.current.handleTocMessage(
        JSON.stringify({ type: "tocPages", payload: { pages, currentPageIndex: 0 } }),
      );
    });

    act(() => {
      result.current.navigateToPage(1);
    });

    expect(mockPostMessage).toHaveBeenCalledWith(
      JSON.stringify({ type: "navigateToPage", payload: { pageId: "p2" } }),
    );
    expect(result.current.currentPageIndex).toBe(1);
  });
});
