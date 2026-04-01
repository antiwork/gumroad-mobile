import { renderHook, act, waitFor } from "@testing-library/react-native";
import { useOTAUpdate } from "./use-ota-update";

const mockCheckForUpdateAsync = jest.fn();
const mockFetchUpdateAsync = jest.fn();
const mockReloadAsync = jest.fn();

jest.mock("expo-updates", () => ({
  checkForUpdateAsync: (...args: unknown[]) => mockCheckForUpdateAsync(...args),
  fetchUpdateAsync: (...args: unknown[]) => mockFetchUpdateAsync(...args),
  reloadAsync: (...args: unknown[]) => mockReloadAsync(...args),
}));

// The hook short-circuits in __DEV__ mode. Override to false so tests exercise the real logic.
// We need to set this before each test because jest may reset it.
const originalDev = (globalThis as Record<string, unknown>).__DEV__;

beforeEach(() => {
  jest.clearAllMocks();
  (globalThis as Record<string, unknown>).__DEV__ = false;
  // Reset the module-level singleton between tests by clearing the cached promise.
  // We access it via the mock: each test starts with a fresh set of mock calls.
});

afterEach(() => {
  (globalThis as Record<string, unknown>).__DEV__ = originalDev;
});

describe("useOTAUpdate", () => {
  it("sets isUpdateReady when an update is available", async () => {
    mockCheckForUpdateAsync.mockResolvedValue({ isAvailable: true });
    mockFetchUpdateAsync.mockResolvedValue({});

    const { result } = renderHook(() => useOTAUpdate());

    await waitFor(() => {
      expect(result.current.isUpdateReady).toBe(true);
    });

    expect(mockCheckForUpdateAsync).toHaveBeenCalledTimes(1);
    expect(mockFetchUpdateAsync).toHaveBeenCalledTimes(1);
  });

  it("does not fetch when no update is available", async () => {
    mockCheckForUpdateAsync.mockResolvedValue({ isAvailable: false });

    const { result } = renderHook(() => useOTAUpdate());

    await waitFor(() => {
      expect(mockCheckForUpdateAsync).toHaveBeenCalledTimes(1);
    });

    expect(mockFetchUpdateAsync).not.toHaveBeenCalled();
    expect(result.current.isUpdateReady).toBe(false);
  });

  it("deduplicates concurrent calls from multiple hook instances", async () => {
    let resolveCheck!: (value: { isAvailable: boolean }) => void;
    mockCheckForUpdateAsync.mockReturnValue(
      new Promise((resolve) => {
        resolveCheck = resolve;
      }),
    );
    mockFetchUpdateAsync.mockResolvedValue({});

    // Mount 3 hooks simultaneously (simulates multiple Screen components)
    const hook1 = renderHook(() => useOTAUpdate());
    const hook2 = renderHook(() => useOTAUpdate());
    const hook3 = renderHook(() => useOTAUpdate());

    // All three share the same promise, so only one check call
    expect(mockCheckForUpdateAsync).toHaveBeenCalledTimes(1);

    // Resolve the shared check
    await act(async () => {
      resolveCheck({ isAvailable: true });
    });

    await waitFor(() => {
      expect(hook1.result.current.isUpdateReady).toBe(true);
      expect(hook2.result.current.isUpdateReady).toBe(true);
      expect(hook3.result.current.isUpdateReady).toBe(true);
    });

    // Only one download, not three
    expect(mockFetchUpdateAsync).toHaveBeenCalledTimes(1);
  });

  it("dismiss sets isUpdateReady to false", async () => {
    mockCheckForUpdateAsync.mockResolvedValue({ isAvailable: true });
    mockFetchUpdateAsync.mockResolvedValue({});

    const { result } = renderHook(() => useOTAUpdate());

    await waitFor(() => {
      expect(result.current.isUpdateReady).toBe(true);
    });

    act(() => {
      result.current.dismiss();
    });

    expect(result.current.isUpdateReady).toBe(false);
  });

  it("handles errors gracefully without crashing", async () => {
    mockCheckForUpdateAsync.mockRejectedValue(new Error("Network failure"));

    const { result } = renderHook(() => useOTAUpdate());

    await waitFor(() => {
      expect(mockCheckForUpdateAsync).toHaveBeenCalledTimes(1);
    });

    expect(result.current.isUpdateReady).toBe(false);
  });
});
