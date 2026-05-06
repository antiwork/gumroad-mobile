import { useEmailDraft } from "@/components/email-compose/use-email-draft";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook, waitFor } from "@testing-library/react-native";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

const mockedAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe("useEmailDraft", () => {
  beforeEach(() => jest.clearAllMocks());

  it("loads no draft on mount when storage empty", async () => {
    mockedAsyncStorage.getItem.mockResolvedValue(null);
    const { result } = renderHook(() => useEmailDraft());
    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    expect(result.current.draft).toBeNull();
  });

  it("loads existing draft on mount", async () => {
    const stored = JSON.stringify({
      title: "Hi",
      html: "<p>x</p>",
      audienceType: "audience",
      idempotencyKey: "abc",
      savedAt: new Date().toISOString(),
    });
    mockedAsyncStorage.getItem.mockResolvedValue(stored);
    const { result } = renderHook(() => useEmailDraft());
    await waitFor(() => expect(result.current.draft?.title).toBe("Hi"));
  });

  it("ignores draft older than 7 days", async () => {
    const stored = JSON.stringify({
      title: "Old",
      html: "<p>old</p>",
      audienceType: "audience",
      idempotencyKey: "old",
      savedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    });
    mockedAsyncStorage.getItem.mockResolvedValue(stored);
    const { result } = renderHook(() => useEmailDraft());
    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    expect(result.current.draft).toBeNull();
  });

  it("save() writes JSON to storage with savedAt timestamp", async () => {
    mockedAsyncStorage.getItem.mockResolvedValue(null);
    const { result } = renderHook(() => useEmailDraft());
    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    await act(async () => {
      await result.current.save({
        title: "T",
        html: "<p>b</p>",
        idempotencyKey: "k1",
        audienceType: "audience",
      });
    });
    expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith(
      "email-compose-draft-v1",
      expect.stringContaining('"title":"T"'),
    );
    expect(mockedAsyncStorage.setItem.mock.calls[0]?.[1]).toContain('"savedAt":');
  });

  it("clear() removes the storage key", async () => {
    mockedAsyncStorage.getItem.mockResolvedValue(null);
    const { result } = renderHook(() => useEmailDraft());
    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    await act(async () => {
      await result.current.clear();
    });
    expect(mockedAsyncStorage.removeItem).toHaveBeenCalledWith("email-compose-draft-v1");
  });
});
