const mockCaptureException = jest.fn();

jest.mock("@sentry/react-native", () => ({
  init: jest.fn(),
  reactNavigationIntegration: jest.fn(() => ({ name: "ReactNavigation" })),
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

describe("Sentry reporting of a module factory that throws at require time", () => {
  const reportFatalError = jest.fn();

  beforeAll(() => {
    (globalThis as unknown as { ErrorUtils?: unknown }).ErrorUtils = { reportFatalError };
    require("@/lib/sentry");
  });

  beforeEach(() => {
    mockCaptureException.mockClear();
    reportFatalError.mockClear();
  });

  const fatal = () =>
    (globalThis as unknown as { ErrorUtils: { reportFatalError: (error: unknown) => void } }).ErrorUtils;

  it("reports the real error and still hands it to the React Native fatal handler", () => {
    const error = new Error("Requiring module 3141 which threw an exception: cannot read property 'x' of undefined");

    fatal().reportFatalError(error);

    expect(mockCaptureException).toHaveBeenCalledWith(error, { level: "fatal" });
    expect(reportFatalError).toHaveBeenCalledWith(error);
  });

  it("still hands the error to the React Native fatal handler when reporting throws", () => {
    const error = new Error("Requiring module 3141 which threw an exception");
    mockCaptureException.mockImplementationOnce(() => {
      throw new Error("Sentry is not available");
    });

    fatal().reportFatalError(error);

    expect(reportFatalError).toHaveBeenCalledWith(error);
  });

  it("wraps the fatal handler once", () => {
    const wrapped = fatal().reportFatalError;

    require("@/lib/sentry");

    expect(fatal().reportFatalError).toBe(wrapped);
  });
});
