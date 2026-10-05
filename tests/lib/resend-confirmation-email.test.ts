import { RequestError, UnauthorizedError } from "@/lib/request";
import { resendConfirmationEmail } from "@/lib/resend-confirmation-email";

const mockRequestAPI = jest.fn();
jest.mock("@/lib/request", () => {
  const actual = jest.requireActual("@/lib/request");
  return { ...actual, requestAPI: (...args: unknown[]) => mockRequestAPI(...args) };
});

describe("resendConfirmationEmail", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("posts to the resend endpoint with the access token", async () => {
    mockRequestAPI.mockResolvedValue({ success: true, status: "sent" });

    await resendConfirmationEmail("token-1");

    expect(mockRequestAPI).toHaveBeenCalledWith("mobile/sessions/resend_confirmation_email", {
      accessToken: "token-1",
      method: "POST",
    });
  });

  it("reports a sent email", async () => {
    mockRequestAPI.mockResolvedValue({ success: true, status: "sent" });
    await expect(resendConfirmationEmail("t")).resolves.toEqual({ status: "sent" });
  });

  it("reports an already confirmed account", async () => {
    mockRequestAPI.mockResolvedValue({ success: true, status: "already_confirmed" });
    await expect(resendConfirmationEmail("t")).resolves.toEqual({ status: "already_confirmed" });
  });

  it("turns a 429 into a throttled result with the server's wait time", async () => {
    mockRequestAPI.mockRejectedValue(new RequestError(429, "Request failed: 429", "wait", 37));
    await expect(resendConfirmationEmail("t")).resolves.toEqual({ status: "throttled", retryAfterSeconds: 37 });
  });

  it("falls back to a one-minute wait when a 429 has no retry time", async () => {
    mockRequestAPI.mockRejectedValue(new RequestError(429, "Request failed: 429"));
    await expect(resendConfirmationEmail("t")).resolves.toEqual({ status: "throttled", retryAfterSeconds: 60 });
  });

  it("rethrows other failures", async () => {
    const unauthorized = new UnauthorizedError("Unauthorized");
    mockRequestAPI.mockRejectedValue(unauthorized);
    await expect(resendConfirmationEmail("t")).rejects.toBe(unauthorized);

    const forbidden = new RequestError(403, "Request failed: 403 Access denied");
    mockRequestAPI.mockRejectedValue(forbidden);
    await expect(resendConfirmationEmail("t")).rejects.toBe(forbidden);
  });
});
