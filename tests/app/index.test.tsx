import { render, act } from "@testing-library/react-native";

const mockReplace = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace }),
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

import Index from "@/app/index";

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
  });

  it("navigates to /(tabs)/dashboard for creators", async () => {
    mockUseAuth.mockReturnValue({ isLoading: false, isAuthenticated: true, isCreator: true });
    render(<Index />);

    await act(async () => {
      await flushRaf();
    });

    expect(mockReplace).toHaveBeenCalledWith("/(tabs)/dashboard");
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
          content: { data: { installment_id: "abc123", purchase_id: "p1" } },
        },
      },
    });

    render(<Index />);

    await act(async () => {
      await flushRaf();
    });

    expect(mockReplace).toHaveBeenCalledWith("/post/abc123?purchaseId=p1");
    expect(mockReplace).not.toHaveBeenCalledWith("/(tabs)/library");
    expect(mockClearLastNotificationResponseAsync).toHaveBeenCalled();
  });

  it("falls back to default route when notification has no installment_id", async () => {
    mockUseAuth.mockReturnValue({ isLoading: false, isAuthenticated: true, isCreator: false });
    mockGetLastNotificationResponseAsync.mockResolvedValue({
      notification: { request: { content: { data: {} } } },
    });

    render(<Index />);

    await act(async () => {
      await flushRaf();
    });

    expect(mockReplace).toHaveBeenCalledWith("/(tabs)/library");
    expect(mockClearLastNotificationResponseAsync).not.toHaveBeenCalled();
  });

  it("cancels animation frame on unmount", () => {
    mockUseAuth.mockReturnValue({ isLoading: false, isAuthenticated: true, isCreator: true });
    const { unmount } = render(<Index />);

    unmount();

    expect(globalThis.cancelAnimationFrame).toHaveBeenCalledWith(1);
  });
});
