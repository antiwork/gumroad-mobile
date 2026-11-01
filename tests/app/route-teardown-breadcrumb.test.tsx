/* eslint-disable import/first -- jest.mock must precede imports */
const mockAddBreadcrumb = jest.fn();
jest.mock("@/lib/sentry", () => ({
  Sentry: { addBreadcrumb: (...args: unknown[]) => mockAddBreadcrumb(...args) },
}));

jest.mock("react-native-safe-area-context", () => jest.requireActual("react-native-safe-area-context"));

import { RouteTeardownBreadcrumb, recordFocusedRoutePattern } from "@/components/route-teardown-breadcrumb";
import { Text } from "@/components/ui/text";
import { Stack, useRouter, useSegments } from "expo-router";
import { renderRouter } from "expo-router/testing-library";
import { Pressable, View } from "react-native";
import { act, fireEvent } from "@testing-library/react-native";

const hostRef: { current: unknown } = { current: null };

const Layout = () => {
  recordFocusedRoutePattern(useSegments());
  return <Stack screenLayout={(props) => <RouteTeardownBreadcrumb {...props} />} />;
};

const Start = () => {
  const router = useRouter();
  return (
    <Pressable onPress={() => router.push("/detail")}>
      <Text>open detail</Text>
    </Pressable>
  );
};

const Detail = () => {
  const router = useRouter();
  return (
    <View
      ref={(node) => {
        hostRef.current = node;
      }}
    >
      <Pressable onPress={() => router.back()}>
        <Text>go back</Text>
      </Pressable>
    </View>
  );
};

const openAndPopDetail = async (initialUrl: string) => {
  const view = await renderRouter(
    { _layout: Layout, index: Start, "purchase/[token]": Start, detail: Detail },
    { initialUrl },
  );

  fireEvent.press(view.getByText("open detail"));
  await act(async () => {});

  // Pushing keeps the screen below mounted, so nothing has been torn down yet.
  expect(mockAddBreadcrumb).not.toHaveBeenCalled();

  fireEvent.press(view.getByText("go back"));
  await act(async () => {});
};

describe("RouteTeardownBreadcrumb", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    hostRef.current = null;
  });

  it("records the route pair when a stack screen unmounts", async () => {
    await openAndPopDetail("/");

    expect(mockAddBreadcrumb).toHaveBeenCalledTimes(1);
    expect(mockAddBreadcrumb).toHaveBeenCalledWith({
      category: "navigation",
      level: "info",
      message: "Stack screen unmounted",
      data: { from: "detail", to: "/" },
    });
  });

  it("records the route pattern rather than the resolved path", async () => {
    await openAndPopDetail("/purchase/abc123");

    expect(mockAddBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({ data: { from: "detail", to: "/purchase/[token]" } }),
    );
    expect(JSON.stringify(mockAddBreadcrumb.mock.calls)).not.toContain("abc123");
  });

  it("records it while the screen's native view is still attached", async () => {
    let nativeViewAttachedWhenRecorded: boolean | undefined;
    mockAddBreadcrumb.mockImplementation(() => {
      nativeViewAttachedWhenRecorded = hostRef.current !== null;
    });

    await openAndPopDetail("/");

    expect(nativeViewAttachedWhenRecorded).toBe(true);
  });
});
