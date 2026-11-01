/* eslint-disable import/first -- jest.mock must precede imports */
const mockAddBreadcrumb = jest.fn();
jest.mock("@/lib/sentry", () => ({
  Sentry: { addBreadcrumb: (...args: unknown[]) => mockAddBreadcrumb(...args) },
}));

jest.mock("react-native-safe-area-context", () => jest.requireActual("react-native-safe-area-context"));

import { RouteTeardownBreadcrumb, recordFocusedPathname } from "@/components/route-teardown-breadcrumb";
import { Stack, usePathname, useRouter } from "expo-router";
import { renderRouter } from "expo-router/testing-library";
import { Pressable, Text, View } from "react-native";
import { act, fireEvent } from "@testing-library/react-native";

const hostRef: { current: unknown } = { current: null };

const Layout = () => {
  recordFocusedPathname(usePathname());
  return <Stack screenLayout={(props) => <RouteTeardownBreadcrumb {...props} />} />;
};

const Index = () => {
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

const openAndPopDetail = async () => {
  const view = await renderRouter({ _layout: Layout, index: Index, detail: Detail }, { initialUrl: "/" });

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
    await openAndPopDetail();

    expect(mockAddBreadcrumb).toHaveBeenCalledTimes(1);
    expect(mockAddBreadcrumb).toHaveBeenCalledWith({
      category: "navigation",
      level: "info",
      message: "Stack screen unmounted",
      data: { from: "detail", to: "/" },
    });
  });

  it("records it while the screen's native view is still attached", async () => {
    let nativeViewAttachedWhenRecorded: boolean | undefined;
    mockAddBreadcrumb.mockImplementation(() => {
      nativeViewAttachedWhenRecorded = hostRef.current !== null;
    });

    await openAndPopDetail();

    expect(nativeViewAttachedWhenRecorded).toBe(true);
  });
});
