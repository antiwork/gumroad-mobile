import {
  CONTENT_PAGE_NAVIGATION_STATE_MESSAGE_TYPE,
  MOBILE_APP_CONTENT_PAGE_NAVIGATION_COMMAND_MESSAGE_TYPE,
  createContentPageNavigationCommandMessage,
  parsePurchaseWebViewMessage,
} from "@/lib/purchase-content-navigation";

describe("purchase content navigation", () => {
  describe("parsePurchaseWebViewMessage", () => {
    it("parses click messages", () => {
      const rawMessage = JSON.stringify({
        type: "click",
        payload: {
          resourceId: "resource-1",
          isDownload: false,
          isPost: false,
        },
      });

      expect(parsePurchaseWebViewMessage(rawMessage)).toEqual({
        type: "click",
        payload: {
          resourceId: "resource-1",
          isDownload: false,
          isPost: false,
        },
      });
    });

    it("parses content page navigation state messages", () => {
      const rawMessage = JSON.stringify({
        type: CONTENT_PAGE_NAVIGATION_STATE_MESSAGE_TYPE,
        payload: {
          isVisible: true,
          hasTableOfContents: true,
          canGoPrevious: false,
          canGoNext: true,
        },
      });

      expect(parsePurchaseWebViewMessage(rawMessage)).toEqual({
        type: CONTENT_PAGE_NAVIGATION_STATE_MESSAGE_TYPE,
        payload: {
          isVisible: true,
          hasTableOfContents: true,
          canGoPrevious: false,
          canGoNext: true,
        },
      });
    });

    it("returns null for malformed json", () => {
      expect(parsePurchaseWebViewMessage("{")).toBeNull();
    });

    it("returns null for messages with unsupported types", () => {
      const rawMessage = JSON.stringify({
        type: "unknown",
        payload: {},
      });

      expect(parsePurchaseWebViewMessage(rawMessage)).toBeNull();
    });

    it("returns null for click messages with missing resource id", () => {
      const rawMessage = JSON.stringify({
        type: "click",
        payload: {
          isDownload: false,
          isPost: false,
        },
      });

      expect(parsePurchaseWebViewMessage(rawMessage)).toBeNull();
    });
  });

  describe("createContentPageNavigationCommandMessage", () => {
    it("builds a navigation command message", () => {
      expect(createContentPageNavigationCommandMessage("goNext")).toBe(
        JSON.stringify({
          type: MOBILE_APP_CONTENT_PAGE_NAVIGATION_COMMAND_MESSAGE_TYPE,
          payload: { action: "goNext" },
        }),
      );
    });
  });
});
