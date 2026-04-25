import { Platform } from "react-native";
import * as BackgroundFetch from "expo-background-fetch";
import * as SecureStore from "expo-secure-store";

let taskCallback: () => Promise<BackgroundFetch.BackgroundFetchResult>;

jest.mock("expo-task-manager", () => ({
  defineTask: jest.fn((_: string, cb: () => Promise<number>) => {
    taskCallback = cb;
  }),
  isTaskRegisteredAsync: jest.fn(),
}));

jest.mock("expo-background-fetch", () => ({
  BackgroundFetchResult: {
    NewData: 2,
    NoData: 1,
    Failed: 3,
  },
  registerTaskAsync: jest.fn(),
}));

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
}));

const mockUpdateSnapshot = jest.fn();
jest.mock("@/components/revenue-widget", () => ({
  __esModule: true,
  default: { updateSnapshot: mockUpdateSnapshot },
}));

const mockRequestWidgetUpdate = jest.fn();
jest.mock("react-native-android-widget", () => ({
  __esModule: true,
  requestWidgetUpdate: mockRequestWidgetUpdate,
}));

jest.mock("@/components/revenue-widget-android", () => ({
  __esModule: true,
  RevenueWidgetAndroid: () => null,
}));

const mockFetchRevenueTotals = jest.fn();
jest.mock("@/lib/request", () => ({
  buildApiUrl: jest.fn((path: string) => `https://api.gumroad.com/${path}`),
  request: (...args: unknown[]) => mockFetchRevenueTotals(...args),
  useAPIRequest: jest.fn(),
}));

jest.mock("@/lib/auth-context", () => ({
  useAuth: jest.fn(() => ({ accessToken: null, isLoading: false })),
}));

const mockGetItemAsync = SecureStore.getItemAsync as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

beforeAll(() => {
  jest.isolateModules(() => {
    require("@/components/use-revenue-widget");
  });
});

describe("background fetch task", () => {
  it("bails out early on Android with NoData", async () => {
    const originalOS = Platform.OS;
    (Platform as any).OS = "android";

    const result = await taskCallback();

    expect(result).toBe(BackgroundFetch.BackgroundFetchResult.NoData);
    expect(mockGetItemAsync).not.toHaveBeenCalled();

    (Platform as any).OS = originalOS;
  });

  it("returns NoData when no access token on iOS", async () => {
    const originalOS = Platform.OS;
    (Platform as any).OS = "ios";
    mockGetItemAsync.mockResolvedValue(null);

    const result = await taskCallback();

    expect(result).toBe(BackgroundFetch.BackgroundFetchResult.NoData);

    (Platform as any).OS = originalOS;
  });

  it("returns NewData on successful fetch on iOS", async () => {
    const originalOS = Platform.OS;
    (Platform as any).OS = "ios";
    mockGetItemAsync.mockResolvedValue("test-token");
    mockFetchRevenueTotals.mockResolvedValue({
      day: { formatted_revenue: "$10" },
      week: { formatted_revenue: "$50" },
      month: { formatted_revenue: "$200" },
      year: { formatted_revenue: "$2000" },
    });

    const result = await taskCallback();

    expect(result).toBe(BackgroundFetch.BackgroundFetchResult.NewData);
    expect(mockUpdateSnapshot).toHaveBeenCalled();

    (Platform as any).OS = originalOS;
  });

  it("returns Failed when fetch throws on iOS", async () => {
    const originalOS = Platform.OS;
    (Platform as any).OS = "ios";
    mockGetItemAsync.mockResolvedValue("test-token");
    mockFetchRevenueTotals.mockRejectedValue(new Error("network error"));

    const result = await taskCallback();

    expect(result).toBe(BackgroundFetch.BackgroundFetchResult.Failed);

    (Platform as any).OS = originalOS;
  });

  it("returns Failed when SecureStore throws on iOS", async () => {
    const originalOS = Platform.OS;
    (Platform as any).OS = "ios";
    mockGetItemAsync.mockRejectedValue(new Error("secure store error"));

    const result = await taskCallback();

    expect(result).toBe(BackgroundFetch.BackgroundFetchResult.Failed);

    (Platform as any).OS = originalOS;
  });
});
