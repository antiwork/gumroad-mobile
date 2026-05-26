import { render, act } from "@testing-library/react-native";

const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
}));

jest.mock("expo-splash-screen", () => ({
  preventAutoHideAsync: jest.fn(),
  hideAsync: jest.fn(),
}));

const mockGetLastNotificationResponseAsync = jest.fn();
const mockClearLastNotificationResponseAsync = jest.fn();
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  getLastNotificationResponseAsync: () => mockGetLastNotificationResponseAsync(),
  clearLastNotificationResponseAsync: () => mockClearLastNotificationResponseAsync(),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
}));

const mockUseAuth = jest.fn();
jest.mock("@/lib/auth-context", () => ({
  useAuth: () => mockUseAuth(),
}));

const mockMarkIndexInitialRoutingComplete = jest.fn();
jest.mock("@/components/use-push-notifications", () => {
  const actual = jest.requireActual<typeof import("@/components/use-push-notifications")>(
    "@/components/use-push-notifications",
  );
  return {
    ...actual,
    markIndexInitialRoutingComplete: () => mockMarkIndexInitialRoutingComplete(),
  };
});

import Index from "@/app/index";
import { __resetPushNotificationsModuleStateForTests } from "@/components/use-push-notifications";

describe("Index", () => {
  let rafCallbacks: Array<() => unknown>;
  let originalRAF: typeof globalThis.requestAnimationFrame;
  let originalCAF: typeof globalThis.cancelAnimationFrame;

  const flushRaf = async () => {
    for (const cb of rafCallbacks) {
      await cb();
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    __resetPushNotificationsModuleStateForTests();
    mockGetLastNotificationResponseAsync.mockResolvedValue(null);
    mockClearLastNotificationResponseAsync.mockResolvedValue(undefined);
    rafCallbacks = [];
    originalRAF = globalThis.requestAnimationFrame;
    originalCAF = globalThis.cancelAnimationFrame;
    globalThis.requestAnimationFrame = jest.fn((cb: FrameRequestCallback) => {
      rafCallbacks.push(() => cb(0));
      return rafCallbacks.length;
    }) as unknown as typeof globalThis.requestAnimationFrame;
    globalThis.cancelAnimationFrame = jest.fn();
  });

  afterEach(() => {
    globalThis.requestAnimationFrame = originalRAF;
    globalThis.cancelAnimationFrame = originalCAF;
  });

  it("returns null while loading", () => {
    mockUseAuth.mockReturnValue({ isLoading: true, isAuthenticated: false, isCreator: false });
    const { toJSON } = render(<Index />);
    expect(toJSON()).toBeNull();
  });

  it("returns null after loading (no Redirect component)", () => {
    mockUseAuth.mockReturnValue({ isLoading: false, isAuthenticated: true, isCreator: true });
    const { toJSON } = render(<Index />);
    expect(toJSON()).toBeNull();
  });

  it("does not navigate synchronously", () => {
    mockUseAuth.mockReturnValue({ isLoading: false, isAuthenticated: false, isCreator: false });
    render(<Index />);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("navigates to /login for unauthenticated users after requestAnimationFrame", async () => {
    mockUseAuth.mockReturnValue({ isLoading: false, isAuthenticated: false, isCreator: false });
    render(<Index />);

    await act(async () => {
      await flushRaf();
    });

    expect(mockReplace).toHaveBeenCalledWith("/login");
    expect(mockGetLastNotificationResponseAsync).not.toHaveBeenCalled();
    expect(mockMarkIndexInitialRoutingComplete).toHaveBeenCalledTimes(1);
  });

  it("navigates to /(tabs)/dashboard for creators", async () => {
    mockUseAuth.mockReturnValue({ isLoading: false, isAuthenticated: true, isCreator: true });
    render(<Index />);

    await act(async () => {
      await flushRaf();
    });

    expect(mockReplace).toHaveBeenCalledWith("/(tabs)/dashboard");
    expect(mockMarkIndexInitialRoutingComplete).toHaveBeenCalledTimes(1);
  });

  it("navigates to /(tabs)/library for non-creators", async () => {
    mockUseAuth.mockReturnValue({ isLoading: false, isAuthenticated: true, isCreator: false });
    render(<Index />);

    await act(async () => {
      await flushRaf();
    });

    expect(mockReplace).toHaveBeenCalledWith("/(tabs)/library");
  });

  it("navigates to the linked post when launched from a notification tap", async () => {
    mockUseAuth.mockReturnValue({ isLoading: false, isAuthenticated: true, isCreator: false });
    mockGetLastNotificationResponseAsync.mockResolvedValue({
      notification: {
        request: {
          identifier: "notif-1",
          content: { data: { installment_id: "abc123", purchase_id: "p1" } },
        },
      },
    });

    render(<Index />);

    await act(async () => {
      await flushRaf();
    });

    expect(mockReplace).toHaveBeenCalledWith("/(tabs)/library");
    expect(mockPush).toHaveBeenCalledWith("/post/abc123?purchaseId=p1");
    expect(mockClearLastNotificationResponseAsync).toHaveBeenCalled();
    expect(mockMarkIndexInitialRoutingComplete).toHaveBeenCalledTimes(1);
  });

  it("uses /(tabs)/dashboard as the back target for creators launched via notification", async () => {
    mockUseAuth.mockReturnValue({ isLoading: false, isAuthenticated: true, isCreator: true });
    mockGetLastNotificationResponseAsync.mockResolvedValue({
      notification: {
        request: {
          identifier: "notif-2",
          content: { data: { installment_id: "xyz" } },
        },
      },
    });

    render(<Index />);

    await act(async () => {
      await flushRaf();
    });

    expect(mockReplace).toHaveBeenCalledWith("/(tabs)/dashboard");
    expect(mockPush).toHaveBeenCalledWith("/post/xyz");
  });

  it("falls back to default route when notification has no installment_id", async () => {
    mockUseAuth.mockReturnValue({ isLoading: false, isAuthenticated: true, isCreator: false });
    mockGetLastNotificationResponseAsync.mockResolvedValue({
      notification: { request: { identifier: "notif-3", content: { data: {} } } },
    });

    render(<Index />);

    await act(async () => {
      await flushRaf();
    });

    expect(mockReplace).toHaveBeenCalledWith("/(tabs)/library");
    expect(mockClearLastNotificationResponseAsync).not.toHaveBeenCalled();
  });

  it("falls back to default route when the notifications API throws", async () => {
    mockUseAuth.mockReturnValue({ isLoading: false, isAuthenticated: true, isCreator: false });
    mockGetLastNotificationResponseAsync.mockRejectedValue(new Error("native module unavailable"));

    render(<Index />);

    await act(async () => {
      await flushRaf();
    });

    expect(mockReplace).toHaveBeenCalledWith("/(tabs)/library");
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("cancels animation frame on unmount", () => {
    mockUseAuth.mockReturnValue({ isLoading: false, isAuthenticated: true, isCreator: true });
    const { unmount } = render(<Index />);

    unmount();

    expect(globalThis.cancelAnimationFrame).toHaveBeenCalledWith(1);
  });

  it("does not navigate or mark routing complete when the effect is cancelled mid-await", async () => {
    mockUseAuth.mockReturnValue({ isLoading: false, isAuthenticated: true, isCreator: false });
    let resolveResponse: ((value: unknown) => void) | undefined;
    mockGetLastNotificationResponseAsync.mockImplementation(
      () => new Promise((resolve) => (resolveResponse = resolve)),
    );

    const { unmount } = render(<Index />);

    await act(async () => {
      for (const cb of rafCallbacks) cb();
    });

    unmount();
    resolveResponse?.({
      notification: { request: { identifier: "stale-1", content: { data: { installment_id: "stale-post" } } } },
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockMarkIndexInitialRoutingComplete).not.toHaveBeenCalled();
  });
});
