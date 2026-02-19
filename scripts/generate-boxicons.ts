import * as fs from "fs";
import * as path from "path";

type Pack = "basic" | "filled" | "brands";

interface SvgElement {
  tag: string;
  attrs: Record<string, string>;
}

interface PackData {
  viewBox: string;
  elements: SvgElement[];
}

type IconEntry = Partial<Record<Pack, PackData>>;

const iconsDir = path.join(
  __dirname,
  "../node_modules/@boxicons/react/dist/esm/icons",
);
const outputPath = path.join(__dirname, "../components/icons-generated.ts");

const iconFiles = fs
  .readdirSync(iconsDir)
  .filter((f) => f.endsWith(".js") && f !== "index.js");

const pathsObjRegex = /const paths = \{([\s\S]*?)\};\s*\nconst /;
const packEntryRegex =
  /(\w+):\s*\{\s*viewBox:\s*'([^']+)',\s*content:\s*`([^`]+)`\s*\}/g;
const svgElementRegex = /<(\w+)\s+([^>]*?)\/>/g;
const attrRegex = /(\w[\w-]*)="([^"]*)"/g;

const toPack = (raw: string): Pack | null => {
  if (raw === "basic" || raw === "filled" || raw === "brands") return raw;
  return null;
};

const toKebabCase = (name: string): string =>
  name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();

const parseSvgElements = (content: string): SvgElement[] => {
  const results: SvgElement[] = [];
  let match;
  while ((match = svgElementRegex.exec(content)) !== null) {
    const tag = match[1];
    const attrString = match[2];
    const attrs: Record<string, string> = {};
    let attrMatch;
    while ((attrMatch = attrRegex.exec(attrString)) !== null) {
      attrs[attrMatch[1]] = attrMatch[2];
    }
    if (Object.keys(attrs).length > 0) {
      results.push({ tag, attrs });
    }
  }
  return results;
};

const icons: Record<string, IconEntry> = {};
let skipped = 0;

for (const file of iconFiles) {
  const componentName = file.replace(".js", "");
  const kebabName = toKebabCase(componentName);
  const source = fs.readFileSync(path.join(iconsDir, file), "utf-8");

  const objMatch = pathsObjRegex.exec(source);
  if (!objMatch) {
    skipped++;
    continue;
  }

  const objBody = objMatch[1];
  const entry: IconEntry = {};
  let packMatch;
  while ((packMatch = packEntryRegex.exec(objBody)) !== null) {
    const pack = toPack(packMatch[1]);
    if (!pack) continue;
    const viewBox = packMatch[2];
    const content = packMatch[3];
    svgElementRegex.lastIndex = 0;
    attrRegex.lastIndex = 0;
    const elements = parseSvgElements(content);
    if (elements.length > 0) {
      entry[pack] = { viewBox, elements };
    }
  }
  packEntryRegex.lastIndex = 0;

  if (Object.keys(entry).length > 0) {
    icons[kebabName] = entry;
  }
}

const packs: Pack[] = ["basic", "filled", "brands"];
const counts = Object.fromEntries(
  packs.map((pack) => [
    pack,
    Object.values(icons).filter((e) => e[pack]).length,
  ]),
);

const output = `export type IconPack = "basic" | "filled" | "brands";

interface SvgElement {
  tag: string;
  attrs: Record<string, string>;
}

interface PackData {
  viewBox: string;
  elements: SvgElement[];
}

export type IconEntry = Partial<Record<IconPack, PackData>>;

export const iconData: Record<string, IconEntry> = ${JSON.stringify(icons)};
`;

fs.writeFileSync(outputPath, output);

// eslint-disable-next-line no-console
console.log(
  `Generated ${Object.keys(icons).length} icons (${counts.basic} basic, ${counts.filled} filled, ${counts.brands} brands), skipped ${skipped} to ${outputPath}`,
);
