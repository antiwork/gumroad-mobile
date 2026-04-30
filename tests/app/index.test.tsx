import { render, act } from "@testing-library/react-native";

const mockReplace = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock("expo-splash-screen", () => ({
  preventAutoHideAsync: jest.fn(),
  hideAsync: jest.fn(),
}));

const mockUseAuth = jest.fn();
jest.mock("@/lib/auth-context", () => ({
  useAuth: () => mockUseAuth(),
}));

import Index from "@/app/index";

describe("Index", () => {
  let rafCallbacks: Array<() => void>;
  let originalRAF: typeof globalThis.requestAnimationFrame;
  let originalCAF: typeof globalThis.cancelAnimationFrame;

  beforeEach(() => {
    jest.clearAllMocks();
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

  it("navigates to /login for unauthenticated users after requestAnimationFrame", () => {
    mockUseAuth.mockReturnValue({ isLoading: false, isAuthenticated: false, isCreator: false });
    render(<Index />);

    act(() => {
      rafCallbacks.forEach((cb) => cb());
    });

    expect(mockReplace).toHaveBeenCalledWith("/login");
  });

  it("navigates to /(tabs)/dashboard for creators", () => {
    mockUseAuth.mockReturnValue({ isLoading: false, isAuthenticated: true, isCreator: true });
    render(<Index />);

    act(() => {
      rafCallbacks.forEach((cb) => cb());
    });

    expect(mockReplace).toHaveBeenCalledWith("/(tabs)/dashboard");
  });

  it("navigates to /(tabs)/library for non-creators", () => {
    mockUseAuth.mockReturnValue({ isLoading: false, isAuthenticated: true, isCreator: false });
    render(<Index />);

    act(() => {
      rafCallbacks.forEach((cb) => cb());
    });

    expect(mockReplace).toHaveBeenCalledWith("/(tabs)/library");
  });

  it("cancels animation frame on unmount", () => {
    mockUseAuth.mockReturnValue({ isLoading: false, isAuthenticated: true, isCreator: true });
    const { unmount } = render(<Index />);

    unmount();

    expect(globalThis.cancelAnimationFrame).toHaveBeenCalledWith(1);
  });
});
