export type ClickPayload = {
  resourceId: string;
  isDownload: boolean;
  isPost: boolean;
  type?: string | null;
  extension?: string | null;
  isPlaying?: "true" | "false" | null;
  resumeAt?: string | null;
  contentLength?: string | null;
};

export type ClickMessage = {
  type: "click";
  payload: ClickPayload;
};

export const CONTENT_PAGE_NAVIGATION_STATE_MESSAGE_TYPE = "contentPageNavigationState";
export const MOBILE_APP_CONTENT_PAGE_NAVIGATION_COMMAND_MESSAGE_TYPE = "mobileAppContentPageNavigationCommand";

export type ContentPageNavigationStatePayload = {
  isVisible: boolean;
  hasTableOfContents: boolean;
  canGoPrevious: boolean;
  canGoNext: boolean;
};

export type ContentPageNavigationStateMessage = {
  type: typeof CONTENT_PAGE_NAVIGATION_STATE_MESSAGE_TYPE;
  payload: ContentPageNavigationStatePayload;
};

export type MobileAppContentPageNavigationCommandAction = "openTableOfContents" | "goPrevious" | "goNext";

const OPEN_TABLE_OF_CONTENTS_ACTION: MobileAppContentPageNavigationCommandAction = "openTableOfContents";
const GO_PREVIOUS_ACTION: MobileAppContentPageNavigationCommandAction = "goPrevious";
const GO_NEXT_ACTION: MobileAppContentPageNavigationCommandAction = "goNext";

type PurchaseWebViewMessage = ClickMessage | ContentPageNavigationStateMessage;

type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isClickPayload = (value: unknown): value is ClickPayload => {
  if (!isRecord(value)) return false;

  return typeof value.resourceId === "string";
};

const isClickMessage = (value: unknown): value is ClickMessage =>
  isRecord(value) && value.type === "click" && isClickPayload(value.payload);

const isContentPageNavigationStatePayload = (value: unknown): value is ContentPageNavigationStatePayload => {
  if (!isRecord(value)) return false;

  return (
    typeof value.isVisible === "boolean" &&
    typeof value.hasTableOfContents === "boolean" &&
    typeof value.canGoPrevious === "boolean" &&
    typeof value.canGoNext === "boolean"
  );
};

const isContentPageNavigationStateMessage = (value: unknown): value is ContentPageNavigationStateMessage =>
  isRecord(value) &&
  value.type === CONTENT_PAGE_NAVIGATION_STATE_MESSAGE_TYPE &&
  isContentPageNavigationStatePayload(value.payload);

export const parsePurchaseWebViewMessage = (data: string): PurchaseWebViewMessage | null => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(data);
  } catch {
    return null;
  }

  if (isClickMessage(parsed)) return parsed;
  if (isContentPageNavigationStateMessage(parsed)) return parsed;
  return null;
};

export const createContentPageNavigationCommandMessage = (action: MobileAppContentPageNavigationCommandAction) =>
  JSON.stringify({
    type: MOBILE_APP_CONTENT_PAGE_NAVIGATION_COMMAND_MESSAGE_TYPE,
    payload: { action },
  });

export const DEFAULT_CONTENT_PAGE_NAVIGATION_STATE: ContentPageNavigationStatePayload = {
  isVisible: false,
  hasTableOfContents: false,
  canGoPrevious: false,
  canGoNext: false,
};

const CONTENT_PAGE_NAVIGATION_STATE_DEBOUNCE_MS = 60;
const CONTENT_PAGE_NAVIGATION_STATE_AFTER_ACTION_DELAY_MS = 150;
const CONTENT_PAGE_NAVIGATION_STATE_AFTER_LOAD_DELAY_MS = 400;

export const purchaseContentNavigationBridgeScript = `
(() => {
  if (window.__gumroadMobileContentNavigationBridgeInstalled) return;
  window.__gumroadMobileContentNavigationBridgeInstalled = true;

  const commandType = "${MOBILE_APP_CONTENT_PAGE_NAVIGATION_COMMAND_MESSAGE_TYPE}";
  const stateType = "${CONTENT_PAGE_NAVIGATION_STATE_MESSAGE_TYPE}";
  const openTableOfContentsAction = "${OPEN_TABLE_OF_CONTENTS_ACTION}";
  const goPreviousAction = "${GO_PREVIOUS_ACTION}";
  const goNextAction = "${GO_NEXT_ACTION}";
  const clickableSelector = "button, a, [role='button']";
  const disabledClassPattern = /\\bdisabled\\b/i;
  const debounceMs = ${CONTENT_PAGE_NAVIGATION_STATE_DEBOUNCE_MS};
  const afterActionDelayMs = ${CONTENT_PAGE_NAVIGATION_STATE_AFTER_ACTION_DELAY_MS};
  const afterLoadDelayMs = ${CONTENT_PAGE_NAVIGATION_STATE_AFTER_LOAD_DELAY_MS};

  let lastSerializedState = "";
  let updateTimeoutId = null;

  const normalizeText = (value) => value.toLowerCase().replace(/\\s+/g, " ").trim();
  const getClickableElements = (root) => Array.from(root.querySelectorAll(clickableSelector));
  const getElementText = (element) => normalizeText(element.innerText || element.textContent || "");
  const hasAnyLabel = (element, labels) => {
    const text = getElementText(element);
    return labels.some((label) => text.includes(label));
  };

  const findElementsByLabels = (labels, root = document) =>
    getClickableElements(root).filter((element) => hasAnyLabel(element, labels));

  const findNearestSharedContainer = (first, second) => {
    let current = first.parentElement;
    while (current && current !== document.body) {
      if (current.contains(second)) return current;
      current = current.parentElement;
    }
    return null;
  };

  const findBestNavigationPair = () => {
    const previousCandidates = findElementsByLabels(["previous"]);
    const nextCandidates = findElementsByLabels(["next"]);

    let bestMatch = null;
    let bestScore = Number.MAX_SAFE_INTEGER;

    for (const previousButton of previousCandidates) {
      for (const nextButton of nextCandidates) {
        const container = findNearestSharedContainer(previousButton, nextButton);
        if (!container) continue;

        const score = getClickableElements(container).length;
        if (score >= bestScore) continue;

        bestScore = score;
        bestMatch = { previousButton, nextButton, container };
      }
    }

    return bestMatch;
  };

  const findTableOfContentsButton = (container, previousButton, nextButton) => {
    if (container) {
      const elements = getClickableElements(container);
      for (const element of elements) {
        if (element === previousButton || element === nextButton) continue;
        if (hasAnyLabel(element, ["previous", "next"])) continue;
        return element;
      }
    }
    return null;
  };

  const findControls = () => {
    const pair = findBestNavigationPair();
    if (!pair) {
      return { previousButton: null, nextButton: null, tableOfContentsButton: null, container: null };
    }

    const tableOfContentsButton = findTableOfContentsButton(pair.container, pair.previousButton, pair.nextButton);

    return {
      previousButton: pair.previousButton,
      nextButton: pair.nextButton,
      tableOfContentsButton,
      container: pair.container,
    };
  };

  const isDisabled = (element) => {
    if (!element) return true;
    if (element.hasAttribute("disabled")) return true;
    if (element.getAttribute("aria-disabled") === "true") return true;

    const className = typeof element.className === "string" ? element.className : "";
    return disabledClassPattern.test(className);
  };

  const hideHtmlControls = (container) => {
    if (!container) return;
    if (container.dataset.gumroadMobileNativeFooterHidden === "true") return;

    container.dataset.gumroadMobileNativeFooterHidden = "true";
    container.style.display = "none";
  };

  const postNavigationState = () => {
    const { previousButton, nextButton, tableOfContentsButton, container } = findControls();

    if (container) hideHtmlControls(container);

    const payload = {
      isVisible: Boolean(previousButton || nextButton || tableOfContentsButton),
      hasTableOfContents: Boolean(tableOfContentsButton),
      canGoPrevious: Boolean(previousButton) && !isDisabled(previousButton),
      canGoNext: Boolean(nextButton) && !isDisabled(nextButton),
    };

    const serializedPayload = JSON.stringify(payload);
    if (serializedPayload === lastSerializedState) return;
    lastSerializedState = serializedPayload;

    if (!window.ReactNativeWebView || typeof window.ReactNativeWebView.postMessage !== "function") return;
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: stateType, payload }));
  };

  const click = (element) => {
    if (!element || typeof element.click !== "function") return false;
    element.click();
    return true;
  };

  const runAction = (action) => {
    const { previousButton, nextButton, tableOfContentsButton } = findControls();

    const didClick =
      action === openTableOfContentsAction
        ? click(tableOfContentsButton)
        : action === goPreviousAction
          ? click(previousButton)
          : action === goNextAction
            ? click(nextButton)
            : false;

    if (didClick) window.setTimeout(postNavigationState, afterActionDelayMs);
  };

  const handleMessage = (event) => {
    if (!event || typeof event.data !== "string") return;

    let parsed = null;
    try {
      parsed = JSON.parse(event.data);
    } catch {
      return;
    }

    if (!parsed || parsed.type !== commandType || !parsed.payload || typeof parsed.payload.action !== "string") {
      return;
    }

    runAction(parsed.payload.action);
  };

  document.addEventListener("message", handleMessage);
  window.addEventListener("message", handleMessage);

  const observerTarget = document.documentElement || document.body;
  if (observerTarget) {
    const observer = new MutationObserver(() => {
      if (updateTimeoutId !== null) window.clearTimeout(updateTimeoutId);
      updateTimeoutId = window.setTimeout(postNavigationState, debounceMs);
    });

    observer.observe(observerTarget, {
      childList: true,
      subtree: true,
      attributes: true,
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", postNavigationState);
  } else {
    postNavigationState();
  }

  window.setTimeout(postNavigationState, afterLoadDelayMs);
})();
true;
`;
