import { View, ViewProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Screen shell.
 *
 * `railSafe` (default) keeps content clear of the horizontal insets iOS 27 reserves on iPhone Duo:
 * the edge carrying the vertical bar (rail) when the device is folded or open in landscape, and the
 * outer edge in Split View. The background stays edge to edge while only the content is inset, which
 * is what Apple asks for: nothing interactive under the rail, artwork may run beneath it.
 *
 * Screens that paint edge-to-edge video or a full-bleed canvas opt out and handle insets themselves.
 */
export const Screen = ({
  children,
  railSafe = true,
  style,
  ...props
}: ViewProps & { railSafe?: boolean }) => {
  const insets = useSafeAreaInsets();

  return (
    <View {...props} style={style} className="flex-1 border-t border-border bg-body-bg">
      {railSafe ? (
        <View style={{ flex: 1, paddingLeft: insets.left, paddingRight: insets.right }}>{children}</View>
      ) : (
        children
      )}
    </View>
  );
};
