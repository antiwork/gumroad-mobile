import { useResendConfirmationEmail } from "@/components/library/use-resend-confirmation-email";
import { act, renderHook } from "@testing-library/react-native";

const mockResendConfirmationEmail = jest.fn();
jest.mock("@/lib/resend-confirmation-email", () => ({
  resendConfirmationEmail: (...args: unknown[]) => mockResendConfirmationEmail(...args),
}));

jest.mock("@/lib/authed-request", () => ({
  useAuthedRequest: () => (run: (token: string) => Promise<unknown>) => run("test-token"),
}));

describe("useResendConfirmationEmail", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("starts idle with no cooldown", () => {
    const { result } = renderHook(() => useResendConfirmationEmail(jest.fn()));
    expect(result.current.state).toBe("idle");
    expect(result.current.secondsLeft).toBe(0);
  });

  it("starts a one-minute cooldown after a sent email and counts it down", async () => {
    mockResendConfirmationEmail.mockResolvedValue({ status: "sent" });
    const { result } = renderHook(() => useResendConfirmationEmail(jest.fn()));

    await act(async () => {
      await result.current.resend();
    });
    expect(mockResendConfirmationEmail).toHaveBeenCalledWith("test-token");
    expect(result.current.state).toBe("sent");
    expect(result.current.secondsLeft).toBe(60);

    for (let second = 0; second < 3; second++) {
      await act(async () => {
        jest.advanceTimersByTime(1_000);
      });
    }
    expect(result.current.secondsLeft).toBe(57);
  });

  it("uses the server's wait time when throttled", async () => {
    mockResendConfirmationEmail.mockResolvedValue({ status: "throttled", retryAfterSeconds: 12.2 });
    const { result } = renderHook(() => useResendConfirmationEmail(jest.fn()));

    await act(async () => {
      await result.current.resend();
    });
    expect(result.current.state).toBe("throttled");
    expect(result.current.secondsLeft).toBe(13);
  });

  it("refetches the library when the account is already confirmed", async () => {
    mockResendConfirmationEmail.mockResolvedValue({ status: "already_confirmed" });
    const onAlreadyConfirmed = jest.fn();
    const { result } = renderHook(() => useResendConfirmationEmail(onAlreadyConfirmed));

    await act(async () => {
      await result.current.resend();
    });
    expect(onAlreadyConfirmed).toHaveBeenCalledTimes(1);
    expect(result.current.state).toBe("idle");
    expect(result.current.secondsLeft).toBe(0);
  });

  it("reports a failure without a cooldown so the buyer can try again", async () => {
    mockResendConfirmationEmail.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useResendConfirmationEmail(jest.fn()));

    await act(async () => {
      await result.current.resend();
    });
    expect(result.current.state).toBe("failed");
    expect(result.current.secondsLeft).toBe(0);
  });
});
