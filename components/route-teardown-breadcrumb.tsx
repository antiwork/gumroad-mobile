import { Sentry } from "@/lib/sentry";
import { useLayoutEffect, type ReactElement } from "react";

let focusedPathname: string | undefined;

// The root layout renders with the new route before the outgoing screen is removed, so mirroring
// the pathname there is the only route pair that is already fresh at teardown: the removed screen's
// own navigation state still points at itself, and the container's state event lands after the
// removal.
export const recordFocusedPathname = (pathname: string) => {
  focusedPathname = pathname;
};

// Layout cleanup, not a passive one, so the breadcrumb lands before React removes the screen's
// native view — the removal that aborts here.
export const RouteTeardownBreadcrumb = ({ route, children }: { route: { name: string }; children: ReactElement }) => {
  useLayoutEffect(
    () => () => {
      Sentry.addBreadcrumb({
        category: "navigation",
        level: "info",
        message: "Stack screen unmounted",
        data: { from: route.name, to: focusedPathname },
      });
    },
    [route.name],
  );

  return children;
};
