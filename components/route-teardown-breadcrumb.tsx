import { Sentry } from "@/lib/sentry";
import { useLayoutEffect, type ReactElement } from "react";

let focusedRoutePattern: string | undefined;

// Mirrored from the root layout's render: the removed screen's own navigation state still points at
// itself and the container's state event lands after the removal, so this is the only pair that is
// already fresh at teardown. Segments, not the pathname, keep purchase tokens out of crash reports.
export const recordFocusedRoutePattern = (segments: string[]) => {
  focusedRoutePattern = `/${segments.join("/")}`;
};

// Layout cleanup, not a passive one, so the breadcrumb lands before React removes the native view.
export const RouteTeardownBreadcrumb = ({ route, children }: { route: { name: string }; children: ReactElement }) => {
  useLayoutEffect(
    () => () => {
      Sentry.addBreadcrumb({
        category: "navigation",
        level: "info",
        message: "Stack screen unmounted",
        data: { from: route.name, to: focusedRoutePattern },
      });
    },
    [route.name],
  );

  return children;
};
