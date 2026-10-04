import { isUnconfirmedEmailError, resendConfirmationEmail } from "@/lib/email-confirmation";
import { RequestError, requestAPI } from "@/lib/request";

jest.mock("@/lib/request", () => {
  const actual = jest.requireActual("@/lib/request");
  return { ...actual, requestAPI: jest.fn() };
});

const mockRequestAPI = requestAPI as jest.Mock;

beforeEach(() => {
  mockRequestAPI.mockReset();
});

describe("isUnconfirmedEmailError", () => {
  it("is true for a 403, the status the mobile purchases endpoints use for an unconfirmed account", () => {
    expect(isUnconfirmedEmailError(new RequestError(403, "Request failed: 403 Access denied"))).toBe(true);
  });

  it("is false for any other status or a plain error", () => {
    expect(isUnconfirmedEmailError(new RequestError(404, "Request failed: 404 Not found"))).toBe(false);
    expect(isUnconfirmedEmailError(new RequestError(401, "Unauthorized"))).toBe(false);
    expect(isUnconfirmedEmailError(new Error("Network request failed"))).toBe(false);
    expect(isUnconfirmedEmailError(undefined)).toBe(false);
  });
});

describe("resendConfirmationEmail", () => {
  it("posts to the mobile resend endpoint and reports sent", async () => {
    mockRequestAPI.mockResolvedValue({ success: true, status: "sent" });

    await expect(resendConfirmationEmail("token")).resolves.toBe("sent");
    expect(mockRequestAPI).toHaveBeenCalledWith("mobile/sessions/resend_confirmation_email", {
      accessToken: "token",
      method: "POST",
    });
  });

  it("maps an already-confirmed account", async () => {
    mockRequestAPI.mockResolvedValue({ success: true, status: "already_confirmed" });

    await expect(resendConfirmationEmail("token")).resolves.toBe("already_confirmed");
  });

  it("maps the 429 throttle to throttled instead of throwing", async () => {
    mockRequestAPI.mockRejectedValue(new RequestError(429, "Request failed: 429"));

    await expect(resendConfirmationEmail("token")).resolves.toBe("throttled");
  });

  it("rethrows anything else so the screen can report it", async () => {
    mockRequestAPI.mockRejectedValue(new RequestError(500, "Request failed: 500 Server error"));

    await expect(resendConfirmationEmail("token")).rejects.toBeInstanceOf(RequestError);
  });
});
