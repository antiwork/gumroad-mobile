import * as fs from "fs";
import * as path from "path";

const cssPath = path.join(__dirname, "../node_modules/boxicons/css/boxicons.css");
const outputPath = path.join(__dirname, "../components/icons-generated.ts");

const cssContent = fs.readFileSync(cssPath, "utf-8");

const lineGlyphs: Record<string, number> = {};
const solidGlyphs: Record<string, number> = {};
const logoGlyphs: Record<string, number> = {};

const regex = /\.(bx[sl]?)-([a-z0-9-]+):before\s*\{\s*content:\s*"\\([a-fA-F0-9]+)"/g;

let match;
while ((match = regex.exec(cssContent)) !== null) {
  const prefix = match[1];
  const name = match[2];
  const codePoint = parseInt(match[3], 16);

  if (prefix === "bx") {
    lineGlyphs[name] = codePoint;
  } else if (prefix === "bxs") {
    solidGlyphs[name] = codePoint;
  } else if (prefix === "bxl") {
    logoGlyphs[name] = codePoint;
  }
}

const output = `export const lineGlyphMap = ${JSON.stringify(lineGlyphs, null, 2)};

export const solidGlyphMap = ${JSON.stringify(solidGlyphs, null, 2)};

export const logoGlyphMap = ${JSON.stringify(logoGlyphs, null, 2)};
`;

fs.writeFileSync(outputPath, output);

// eslint-disable-next-line no-console
console.log(
  `Generated ${Object.keys(lineGlyphs).length} line, ${Object.keys(solidGlyphs).length} solid, ${Object.keys(logoGlyphs).length} logo icons to ${outputPath}`,
);
