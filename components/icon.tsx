import createIconSet from "@expo/vector-icons/build/createIconSet";
import fontAsset from "boxicons/fonts/boxicons.ttf";
import { withUniwind } from "uniwind";
import { lineGlyphMap, logoGlyphMap, solidGlyphMap } from "./icons-generated";

const BaseLineIcon = createIconSet(lineGlyphMap, "boxicons", fontAsset);
const BaseSolidIcon = createIconSet(solidGlyphMap, "boxicons", fontAsset);
const BaseLogoIcon = createIconSet(logoGlyphMap, "boxicons", fontAsset);

export const LineIcon = withUniwind(BaseLineIcon);
export const SolidIcon = withUniwind(BaseSolidIcon);
export const LogoIcon = withUniwind(BaseLogoIcon);
