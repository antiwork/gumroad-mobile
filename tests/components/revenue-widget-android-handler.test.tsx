// --- Mocks (must be defined before require) ---
let mockSecureStoreToken: string | null = "test-access-token";
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(() => Promise.resolve(mockSecureStoreToken)),
}));

const mockRenderWidget = jest.fn();
let registeredHandler: ((props: any) => Promise<void>) | null = null;
jest.mock("react-native-android-widget", () => ({
  registerWidgetTaskHandler: jest.fn((handler: any) => {
    registeredHandler = handler;
  }),
}));

jest.mock("@/components/revenue-widget-android", () => ({
  RevenueWidgetAndroid: (props: any) => props,
}));

// Import after mocks so the module-level registerWidgetTaskHandler captures our mock.
require("@/components/revenue-widget-android-handler");

beforeEach(() => {
  jest.clearAllMocks();
  mockSecureStoreToken = "test-access-token";
});

const triggerWidgetUpdate = () =>
  registeredHandler!({ widgetAction: "WIDGET_UPDATE", renderWidget: mockRenderWidget });

/** Extract props from the JSX element passed to renderWidget */
const renderedProps = () => mockRenderWidget.mock.calls[0][0].props;

describe("revenue-widget-android-handler", () => {
  it("registers a widget task handler", () => {
    expect(registeredHandler).toBeDefined();
  });

  it("renders logged-out state when no access token", async () => {
    mockSecureStoreToken = null;
    await triggerWidgetUpdate();

    expect(mockRenderWidget).toHaveBeenCalledTimes(1);
    expect(renderedProps()).toMatchObject({ isLoggedIn: false, hasError: false });
  });

  it("renders revenue data on successful fetch", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          day: { formatted_revenue: "$100" },
          week: { formatted_revenue: "$500" },
          month: { formatted_revenue: "$2,000" },
          year: { formatted_revenue: "$10,000" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await triggerWidgetUpdate();

    expect(mockRenderWidget).toHaveBeenCalledTimes(1);
    expect(renderedProps()).toMatchObject({
      today: "$100",
      week: "$500",
      month: "$2,000",
      year: "$10,000",
      isLoggedIn: true,
      hasError: false,
    });
  });

  it("renders error state when fetch fails", async () => {
    jest.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Network error"));

    await triggerWidgetUpdate();

    expect(mockRenderWidget).toHaveBeenCalledTimes(1);
    expect(renderedProps()).toMatchObject({ isLoggedIn: true, hasError: true });
  });

  it(
    "aborts the request and renders error state when it exceeds the widget timeout",
    async () => {
      jest.useFakeTimers();

      // fetch that never resolves until its signal is aborted
      jest.spyOn(globalThis, "fetch").mockImplementationOnce(
        (_url, init) =>
          new Promise<Response>((_resolve, reject) => {
            const signal = init?.signal;
            if (signal?.aborted) {
              reject(new DOMException("Aborted", "AbortError"));
              return;
            }
            signal?.addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError")),
            );
          }),
      );

      const updatePromise = triggerWidgetUpdate();

      // Advance past the 4 s widget timeout (and the 30 s default request timeout)
      await jest.advanceTimersByTimeAsync(31_000);

      await updatePromise;

      expect(mockRenderWidget).toHaveBeenCalledTimes(1);
      expect(renderedProps()).toMatchObject({ isLoggedIn: true, hasError: true });

      jest.useRealTimers();
    },
    35_000,
  );
});
