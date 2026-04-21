import { renderHook, act } from "@testing-library/react-native";
import { InteractionManager } from "react-native";
import { useDeferredMount } from "@/hooks/use-deferred-mount";

describe("useDeferredMount", () => {
  it("starts as not ready", () => {
    // Prevent InteractionManager from resolving immediately
    const spy = jest.spyOn(InteractionManager, "runAfterInteractions").mockReturnValue({
      then: () => ({ done: () => {} }),
      cancel: jest.fn(),
    } as any);

    const { result } = renderHook(() => useDeferredMount());
    expect(result.current).toBe(false);

    spy.mockRestore();
  });

  it("becomes ready after interactions complete", () => {
    let callback: (() => void) | undefined;
    const spy = jest.spyOn(InteractionManager, "runAfterInteractions").mockImplementation((fn: any) => {
      callback = fn;
      return { then: () => ({ done: () => {} }), cancel: jest.fn() } as any;
    });

    const { result } = renderHook(() => useDeferredMount());
    expect(result.current).toBe(false);

    act(() => {
      callback?.();
    });
    expect(result.current).toBe(true);

    spy.mockRestore();
  });

  it("cancels interaction handle on unmount", () => {
    const cancelMock = jest.fn();
    const spy = jest.spyOn(InteractionManager, "runAfterInteractions").mockReturnValue({
      then: () => ({ done: () => {} }),
      cancel: cancelMock,
    } as any);

    const { unmount } = renderHook(() => useDeferredMount());
    unmount();
    expect(cancelMock).toHaveBeenCalled();

    spy.mockRestore();
  });
});
