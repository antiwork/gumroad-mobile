type NotificationResponseListener = (response: unknown) => void;
let capturedListener: NotificationResponseListener | null = null;
const mockClearLastNotificationResponseAsync = jest.fn();
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn((cb: NotificationResponseListener) => {
    capturedListener = cb;
    return { remove: jest.fn() };
  }),
  clearLastNotificationResponseAsync: () => mockClearLastNotificationResponseAsync(),
  getPermissionsAsync: jest.fn(() => Promise.resolve({ status: "denied" })),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: "denied" })),
  getDevicePushTokenAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  AndroidImportance: { MAX: 5 },
}));

const mockRouterPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockRouterPush, replace: jest.fn() }),
}));

const mockUseAuth = jest.fn();
jest.mock("@/lib/auth-context", () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock("@/lib/request", () => ({
  requestAPI: jest.fn(),
}));

jest.mock("expo-application", () => ({ nativeApplicationVersion: "1.0" }));

jest.mock("@sentry/react-native", () => ({ captureException: jest.fn() }));

import { renderHook } from "@testing-library/react-native";
import {
  __resetPushNotificationsModuleStateForTests,
  consumeNotificationRoute,
  markIndexInitialRoutingComplete,
  usePushNotifications,
} from "@/components/use-push-notifications";

const makeResponse = (identifier: string, data: Record<string, string>) =>
  ({ notification: { request: { identifier, content: { data } } } }) as any;

describe("consumeNotificationRoute", () => {
  beforeEach(() => {
    __resetPushNotificationsModuleStateForTests();
  });

  it("returns null when the response is null", () => {
    expect(consumeNotificationRoute(null)).toBeNull();
  });

  it("returns null when the data has no installment_id", () => {
    expect(consumeNotificationRoute(makeResponse("a", { foo: "bar" }))).toBeNull();
  });

  it("builds a /post route with purchaseId when available", () => {
    expect(
      consumeNotificationRoute(makeResponse("p-1", { installment_id: "post1", purchase_id: "p1" })),
    ).toBe("/post/post1?purchaseId=p1");
  });

  it("falls back to subscriptionId or followerId when purchaseId is missing", () => {
    expect(
      consumeNotificationRoute(makeResponse("p-2", { installment_id: "post2", subscription_id: "s2" })),
    ).toBe("/post/post2?subscriptionId=s2");
    expect(
      consumeNotificationRoute(makeResponse("p-3", { installment_id: "post3", follower_id: "f3" })),
    ).toBe("/post/post3?followerId=f3");
  });

  it("reads the payload from the iOS trigger when content.data is null", () => {
    const response = {
      notification: {
        request: {
          identifier: "ios-1",
          content: { data: null },
          trigger: { payload: { installment_id: "postIos", purchase_id: "pIos", aps: { alert: {} } } },
        },
      },
    } as any;
    expect(consumeNotificationRoute(response)).toBe("/post/postIos?purchaseId=pIos");
  });

  it("deduplicates by notification identifier", () => {
    const response = makeResponse("dup-1", { installment_id: "post-dup" });
    expect(consumeNotificationRoute(response)).toBe("/post/post-dup");
    expect(consumeNotificationRoute(response)).toBeNull();
  });

  it("ignores the tag and message fields the Android FCM payload carries", () => {
    expect(
      consumeNotificationRoute(
        makeResponse("a-1", {
          installment_id: "postA",
          purchase_id: "pA",
          tag: "postA",
          message: "New content added to product",
        }),
      ),
    ).toBe("/post/postA?purchaseId=pA");
  });

  it("routes each of several distinct notifications (distinct tags are not deduped)", () => {
    expect(consumeNotificationRoute(makeResponse("postA", { installment_id: "postA", tag: "postA" }))).toBe(
      "/post/postA",
    );
    expect(consumeNotificationRoute(makeResponse("postB", { installment_id: "postB", tag: "postB" }))).toBe(
      "/post/postB",
    );
    expect(consumeNotificationRoute(makeResponse("postC", { installment_id: "postC", tag: "postC" }))).toBe(
      "/post/postC",
    );
  });
});

describe("usePushNotifications listener", () => {
  beforeEach(() => {
    __resetPushNotificationsModuleStateForTests();
    capturedListener = null;
    mockClearLastNotificationResponseAsync.mockReset();
    mockClearLastNotificationResponseAsync.mockResolvedValue(undefined);
    mockRouterPush.mockReset();
    mockUseAuth.mockReturnValue({ isAuthenticated: false, accessToken: null });
  });

  it("ignores notification responses delivered before index marks initial routing complete", () => {
    renderHook(() => usePushNotifications());

    expect(capturedListener).not.toBeNull();
    capturedListener?.(makeResponse("cold-replay-1", { installment_id: "cold-post" }));

    expect(mockRouterPush).not.toHaveBeenCalled();
    expect(mockClearLastNotificationResponseAsync).not.toHaveBeenCalled();
  });

  it("navigates and clears the cached response once index marks initial routing complete", () => {
    renderHook(() => usePushNotifications());
    markIndexInitialRoutingComplete();

    capturedListener?.(makeResponse("live-tap-1", { installment_id: "live-post", purchase_id: "p" }));

    expect(mockRouterPush).toHaveBeenCalledWith("/post/live-post?purchaseId=p");
    expect(mockClearLastNotificationResponseAsync).toHaveBeenCalledTimes(1);
  });

  it("does not navigate or clear when a foreground notification has no installment_id", () => {
    renderHook(() => usePushNotifications());
    markIndexInitialRoutingComplete();

    capturedListener?.(makeResponse("no-data-1", { unrelated: "x" }));

    expect(mockRouterPush).not.toHaveBeenCalled();
    expect(mockClearLastNotificationResponseAsync).not.toHaveBeenCalled();
  });

  it("does not double-navigate when the same notification identifier is delivered twice", () => {
    renderHook(() => usePushNotifications());
    markIndexInitialRoutingComplete();

    const response = makeResponse("repeat-1", { installment_id: "repeat-post" });
    capturedListener?.(response);
    capturedListener?.(response);

    expect(mockRouterPush).toHaveBeenCalledTimes(1);
    expect(mockClearLastNotificationResponseAsync).toHaveBeenCalledTimes(1);
  });

  it("swallows clearLastNotificationResponseAsync rejections so listener stays robust", () => {
    mockClearLastNotificationResponseAsync.mockReturnValue(Promise.reject(new Error("native error")));
    renderHook(() => usePushNotifications());
    markIndexInitialRoutingComplete();

    expect(() =>
      capturedListener?.(makeResponse("clear-fail-1", { installment_id: "post-x" })),
    ).not.toThrow();
    expect(mockRouterPush).toHaveBeenCalledWith("/post/post-x");
  });
});
