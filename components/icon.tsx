import { Path, Svg } from "react-native-svg";
import type { ColorValue } from "react-native";
import { useResolveClassNames } from "uniwind";
import {
  lineIconPaths,
  logoIconPaths,
  solidIconPaths,
  type LineIconName,
  type LogoIconName,
  type SolidIconName,
} from "./icons/icon-paths";

interface IconProps {
  size?: number;
  color?: ColorValue;
  className?: string;
}

type LineIconProps = IconProps & { name: LineIconName };
type SolidIconProps = IconProps & { name: SolidIconName };
type LogoIconProps = IconProps & { name: LogoIconName };

const SvgIcon = ({
  paths,
  size = 24,
  color,
  className,
}: {
  paths: string | readonly string[];
  size?: number;
  color?: ColorValue;
  className?: string;
}) => {
  const resolvedColor = useResolveClassNames(className || "");
  const finalColor = color || resolvedColor.color || "currentColor";
  
  const pathArray = Array.isArray(paths) ? [...paths] : [paths];
  
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={finalColor as string}>
      {pathArray.map((d, i) => (
        <Path key={i} d={d} />
      ))}
    </Svg>
  );
};

export const LineIcon = ({ name, size, color, className }: LineIconProps) => (
  <SvgIcon paths={lineIconPaths[name]} size={size} color={color} className={className} />
);

export const SolidIcon = ({ name, size, color, className }: SolidIconProps) => (
  <SvgIcon paths={solidIconPaths[name]} size={size} color={color} className={className} />
);

export const LogoIcon = ({ name, size, color, className }: LogoIconProps) => (
  <SvgIcon paths={logoIconPaths[name]} size={size} color={color} className={className} />
);
