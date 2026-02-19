import { type ComponentType, forwardRef } from "react";
import { StyleSheet, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { withUniwind } from "uniwind";
import { type IconPack, iconData } from "./icons-generated";

interface IconProps {
  name: string;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}

const svgComponents: Record<string, ComponentType<Record<string, unknown>>> = {
  path: Path as ComponentType<Record<string, unknown>>,
  rect: Rect as ComponentType<Record<string, unknown>>,
};

const kebabToCamel = (s: string) =>
  s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

const BaseIcon = forwardRef<Svg, IconProps & { pack: IconPack }>(
  ({ name, pack, size = 24, color, style, ...props }, ref) => {
    const icon = iconData[name]?.[pack];
    if (!icon) return null;

    const flatStyle = StyleSheet.flatten(style);
    const fill = color ?? flatStyle?.color ?? "black";

    return (
      <Svg
        ref={ref}
        viewBox={icon.viewBox}
        width={size}
        height={size}
        style={style as StyleProp<ViewStyle>}
        {...props}
      >
        {icon.elements.map((el, i) => {
          const Component = svgComponents[el.tag];
          if (!Component) return null;
          const rnProps = Object.fromEntries(
            Object.entries(el.attrs).map(([k, v]) => [kebabToCamel(k), v]),
          );
          return <Component key={i} fill={fill} {...rnProps} />;
        })}
      </Svg>
    );
  },
);

const createPackIcon = (pack: IconPack) => {
  const PackIcon = forwardRef<Svg, IconProps>((props, ref) => (
    <BaseIcon ref={ref} pack={pack} {...props} />
  ));
  return withUniwind(PackIcon);
};

export const LineIcon = createPackIcon("basic");
export const SolidIcon = createPackIcon("filled");
export const LogoIcon = createPackIcon("brands");
