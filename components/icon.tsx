import basicGlyphMap from "@boxicons/core/fonts/basic/boxicons.json";
import basicFont from "@boxicons/core/fonts/basic/boxicons.ttf";
import brandsGlyphMap from "@boxicons/core/fonts/brands/boxicons-brands.json";
import brandsFont from "@boxicons/core/fonts/brands/boxicons-brands.ttf";
import filledGlyphMap from "@boxicons/core/fonts/filled/boxicons-filled.json";
import filledFont from "@boxicons/core/fonts/filled/boxicons-filled.ttf";
import createIconSet from "@expo/vector-icons/build/createIconSet";
import type { ComponentProps } from "react";
import { withUniwind } from "uniwind";

type RawGlyphMap = Record<string, number>;
type BoxiconsKey = `bx-${string}`;
type IconNameFromGlyphMap<TGlyphMap extends RawGlyphMap> = Extract<keyof TGlyphMap, BoxiconsKey> extends infer TKey
  ? TKey extends `bx-${infer TName}`
    ? TName
    : never
  : never;

export type LineIconName = IconNameFromGlyphMap<typeof basicGlyphMap>;
export type SolidIconName = IconNameFromGlyphMap<typeof filledGlyphMap>;
export type LogoIconName = IconNameFromGlyphMap<typeof brandsGlyphMap>;

const toIconSetGlyphMap = (glyphMap: RawGlyphMap) => {
  const normalizedGlyphMap: Record<string, number> = {};

  for (const [name, codePoint] of Object.entries(glyphMap)) {
    if (!name.startsWith("bx-")) continue;

    normalizedGlyphMap[name.slice(3)] = codePoint;
  }

  return normalizedGlyphMap;
};

const BaseLineIcon = createIconSet(toIconSetGlyphMap(basicGlyphMap), "boxicons", basicFont);
const BaseSolidIcon = createIconSet(toIconSetGlyphMap(filledGlyphMap), "boxicons-filled", filledFont);
const BaseLogoIcon = createIconSet(toIconSetGlyphMap(brandsGlyphMap), "boxicons-brands", brandsFont);

const StyledLineIcon = withUniwind(BaseLineIcon);
const StyledSolidIcon = withUniwind(BaseSolidIcon);
const StyledLogoIcon = withUniwind(BaseLogoIcon);

type LineIconProps = Omit<ComponentProps<typeof StyledLineIcon>, "name"> & { name: LineIconName };
type SolidIconProps = Omit<ComponentProps<typeof StyledSolidIcon>, "name"> & { name: SolidIconName };
type LogoIconProps = Omit<ComponentProps<typeof StyledLogoIcon>, "name"> & { name: LogoIconName };

export const LineIcon = ({ name, ...props }: LineIconProps) => <StyledLineIcon name={name} {...props} />;

export const SolidIcon = ({ name, ...props }: SolidIconProps) => <StyledSolidIcon name={name} {...props} />;

export const LogoIcon = ({ name, ...props }: LogoIconProps) => <StyledLogoIcon name={name} {...props} />;
