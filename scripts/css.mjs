import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import postcss from "postcss";
import tailwind from "tailwindcss";
import loadConfig from "tailwindcss/loadConfig.js";
import autoprefixer from "autoprefixer";

const root = fileURLToPath(new URL("../", import.meta.url));
/** Tailwind also emits universal CSS variable defaults with preflight off.
 * Scope those defaults too; utilities already use prefix + important .budde. */
const scopeDefaults = {
  postcssPlugin: "budde-scope-defaults",
  Rule(rule) {
    if (rule.parent?.type === "atrule" && /keyframes$/i.test(rule.parent.name)) return;
    if (!rule.selectors) return;
    rule.selectors = rule.selectors.map(selector => selector.includes(".budde") ? selector : `.budde ${selector}`);
  },
};
export async function buildStyles({ raw } = {}) {
  const config = loadConfig(path.join(root, "tailwind.config.ts"));
  if (raw !== undefined) config.content = [{ raw, extension: "html" }];
  const tokens = await readFile(path.join(root, "src/ui/tokens.css"), "utf8");
  const source = raw !== undefined ? "@tailwind base;\n@tailwind components;\n@tailwind utilities;" : await readFile(path.join(root, "src/ui/styles.css"), "utf8");
  // Keep the official font bytes intact and offline without expanding the
  // plugin's six-file release surface. Only the brand utility opts into it.
  const font = raw === undefined ? await readFile(path.join(root, "src/ui/assets/Quicksand-variable.ttf")) : undefined;
  const brandFace = font ? `@font-face { font-family: BuddeBrandQuicksand; font-style: normal; font-weight: 300 700; font-display: swap; src: url("data:font/ttf;base64,${font.toString("base64")}") format("truetype"); }\n` : "";
  const input = tokens + "\n" + brandFace + source.replace(/@import\s+["']\.\/tokens\.css["'];?/, "");
  const result = await postcss([tailwind(config), autoprefixer, scopeDefaults]).process(input, { from: path.join(root, "src/ui/styles.css"), map: false });
  return result.css;
}
export function buddeCssPlugin() {
  return {
    name: "budde-tailwind-css",
    setup(build) {
      build.onLoad({ filter: /[\\/]src[\\/]ui[\\/]styles\.css$/ }, async () => ({ contents: await buildStyles(), loader: "css", resolveDir: path.join(root, "src/ui") }));
    },
  };
}
