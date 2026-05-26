jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getDevicePushTokenAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  AndroidImportance: { MAX: 5 },
}));

import { consumeNotificationRoute } from "@/components/use-push-notifications";

const makeResponse = (identifier: string, data: Record<string, string>) =>
  ({ notification: { request: { identifier, content: { data } } } }) as any;

describe("consumeNotificationRoute", () => {
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

  it("deduplicates by notification identifier", () => {
    const response = makeResponse("dup-1", { installment_id: "post-dup" });
    expect(consumeNotificationRoute(response)).toBe("/post/post-dup");
    expect(consumeNotificationRoute(response)).toBeNull();
  });
});
