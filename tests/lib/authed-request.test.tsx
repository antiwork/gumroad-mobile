/* eslint-disable import/first -- jest.mock must precede imports */
import * as Sentry from "@sentry/react-native";
import { renderHook } from "@testing-library/react-native";

const mockRefreshToken = jest.fn();
const mockLogout = jest.fn();
const mockGetActiveAccountId = jest.fn();

jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    accessToken: "test-token",
    refreshToken: mockRefreshToken,
    logout: mockLogout,
    getActiveAccountId: mockGetActiveAccountId,
  }),
}));

jest.mock("@sentry/react-native", () => ({
  captureException: jest.fn(),
}));

import { useAuthedRequest } from "@/lib/authed-request";
import { KeychainUnavailableError, SessionExpiredError, UnauthorizedError } from "@/lib/request";

beforeEach(() => {
  jest.clearAllMocks();
  mockGetActiveAccountId.mockReturnValue("owner");
});

const renderAuthedRequest = () => renderHook(() => useAuthedRequest()).result.current;

describe("useAuthedRequest", () => {
  it("logs out without reporting to Sentry when refresh fails with SessionExpiredError", async () => {
    const authedRequest = renderAuthedRequest();
    const unauthorized = new UnauthorizedError("Unauthorized");
    mockRefreshToken.mockRejectedValueOnce(new SessionExpiredError("Refresh token is invalid or expired"));

    await expect(authedRequest(() => Promise.reject(unauthorized))).rejects.toBe(unauthorized);
    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("logs out and reports to Sentry when refresh fails unexpectedly", async () => {
    const authedRequest = renderAuthedRequest();
    const unauthorized = new UnauthorizedError("Unauthorized");
    const refreshError = new Error("Unexpected refresh failure");
    mockRefreshToken.mockRejectedValueOnce(refreshError);

    await expect(authedRequest(() => Promise.reject(unauthorized))).rejects.toBe(unauthorized);
    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(Sentry.captureException).toHaveBeenCalledWith(refreshError, {
      tags: { auth_path: "refresh_failed" },
    });
  });

  it("does not log out when the keychain is unavailable", async () => {
    const authedRequest = renderAuthedRequest();
    const unauthorized = new UnauthorizedError("Unauthorized");
    mockRefreshToken.mockRejectedValueOnce(new KeychainUnavailableError());

    await expect(authedRequest(() => Promise.reject(unauthorized))).rejects.toBe(unauthorized);
    expect(mockLogout).not.toHaveBeenCalled();
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("retries with the new token after a successful refresh", async () => {
    const authedRequest = renderAuthedRequest();
    mockRefreshToken.mockResolvedValueOnce("new-token");
    const run = jest.fn().mockRejectedValueOnce(new UnauthorizedError("Unauthorized")).mockResolvedValueOnce("result");

    await expect(authedRequest(run)).resolves.toBe("result");
    expect(run).toHaveBeenNthCalledWith(1, "test-token");
    expect(run).toHaveBeenNthCalledWith(2, "new-token");
  });

  it("does not replay the request when the refresh recovered a different account", async () => {
    const authedRequest = renderAuthedRequest();
    const unauthorized = new UnauthorizedError("Unauthorized");
    mockRefreshToken.mockImplementationOnce(async () => {
      mockGetActiveAccountId.mockReturnValue("own-account");
      return "owner-token";
    });
    const run = jest.fn().mockRejectedValueOnce(unauthorized);

    await expect(authedRequest(run)).rejects.toBe(unauthorized);
    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith("test-token");
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it("does not replay the request when another request recovered a different account before its 401 arrived", async () => {
    const authedRequest = renderAuthedRequest();
    const unauthorized = new UnauthorizedError("Unauthorized");
    mockRefreshToken.mockResolvedValueOnce("owner-token");
    const run = jest.fn().mockImplementationOnce(async () => {
      mockGetActiveAccountId.mockReturnValue("own-account");
      throw unauthorized;
    });

    await expect(authedRequest(run)).rejects.toBe(unauthorized);
    expect(run).toHaveBeenCalledTimes(1);
    expect(mockLogout).not.toHaveBeenCalled();
  });
});
