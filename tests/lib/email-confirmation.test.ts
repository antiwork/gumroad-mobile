import { isEmailUnconfirmedError, shouldRetry } from "@/lib/email-confirmation";
import { RequestError, ServerError } from "@/lib/request";

const CONFIRM_MESSAGE = "Please confirm your email address before you can see your purchases.";

describe("isEmailUnconfirmedError", () => {
  it("accepts a 403 carrying the confirm-your-email message", () => {
    expect(isEmailUnconfirmedError(new RequestError(403, "Request failed: 403 Access denied", CONFIRM_MESSAGE))).toBe(
      true,
    );
  });

  it("rejects a 403 without the confirm-your-email message", () => {
    expect(isEmailUnconfirmedError(new RequestError(403, "Request failed: 403 Access denied"))).toBe(false);
    expect(isEmailUnconfirmedError(new RequestError(403, "Request failed: 403 Access denied", "Forbidden"))).toBe(
      false,
    );
  });

  it("rejects the confirm-your-email message on another status", () => {
    expect(isEmailUnconfirmedError(new RequestError(400, "Request failed: 400", CONFIRM_MESSAGE))).toBe(false);
    expect(isEmailUnconfirmedError(new ServerError(503, "Request failed: 503"))).toBe(false);
  });

  it("rejects abort, network, and non-error values", () => {
    expect(isEmailUnconfirmedError(Object.assign(new Error("Aborted"), { name: "AbortError" }))).toBe(false);
    expect(isEmailUnconfirmedError(new Error("Network request failed"))).toBe(false);
    expect(isEmailUnconfirmedError(undefined)).toBe(false);
    expect(isEmailUnconfirmedError("403")).toBe(false);
  });
});

describe("shouldRetry", () => {
  const error = new Error("boom");

  it("follows a numeric default", () => {
    expect(shouldRetry(2, 1, error)).toBe(true);
    expect(shouldRetry(2, 2, error)).toBe(false);
  });

  it("follows a boolean default", () => {
    expect(shouldRetry(false, 0, error)).toBe(false);
    expect(shouldRetry(true, 10, error)).toBe(true);
  });

  it("follows a function default", () => {
    expect(shouldRetry(() => false, 0, error)).toBe(false);
  });

  it("falls back to three retries when no default is set", () => {
    expect(shouldRetry(undefined, 2, error)).toBe(true);
    expect(shouldRetry(undefined, 3, error)).toBe(false);
  });
});
