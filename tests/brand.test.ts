import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Icon } from "../src/ui/components/icons";

const root = process.cwd();

test("brand renders the original shared sprout, not the generic Lucide sprout, while ordinary outline icons use the alpha.2 1.5px stroke", async () => {
  const brand = renderToStaticMarkup(createElement(Icon, { name: "brand" }));
  assert.doesNotMatch(brand, /lucide-sprout/, "the selected original sprout must replace the generic brand glyph");
  assert.match(brand, /width="24"/);
  assert.match(brand, /height="24"/);
  assert.match(brand, /aria-hidden="true"/);
  assert.match(brand, /focusable="false"/);
  const { BUDDE_ICON_SYMBOL } = await import(pathToFileURL(path.join(root, "src/brand.ts")).href);
  assert.equal(brand.match(/ d="([^"]+)"/)?.[1], BUDDE_ICON_SYMBOL.match(/ d="([^"]+)"/)?.[1], "workbench and host must render the same path");
  assert.match(BUDDE_ICON_SYMBOL, /id="iconBudde"/);
  assert.match(BUDDE_ICON_SYMBOL, /stroke="currentColor"/);
  assert.match(BUDDE_ICON_SYMBOL, /fill:none!important/);
  assert.match(brand, /style="fill:none;stroke:currentColor"/);
  const ordinary = renderToStaticMarkup(createElement(Icon, { name: "pool" }));
  assert.match(ordinary, /lucide-inbox/);
  assert.match(ordinary, /width="16"/);
  assert.match(ordinary, /stroke-width="1.5"/);
  assert.match(ordinary, /style="fill:none;stroke:currentColor"/);
  assert.match(brand, /stroke-width="1.75"/);
});

test("production CSS embeds the unmodified offline Quicksand font and scopes the family to the wordmark", async () => {
  const { buildStyles } = await import(pathToFileURL(path.join(root, "scripts/css.mjs")).href);
  const css: string = await buildStyles();
  const face = css.match(/@font-face\s*\{([^}]+)\}/)?.[1];
  assert.ok(face, "production CSS must contain a local font face");
  assert.match(face, /font-family:\s*["']?BuddeBrandQuicksand/);
  assert.match(face, /font-weight:\s*300 700/);
  const encoded = face.match(/data:font\/ttf;base64,([A-Za-z0-9+/=]+)/)?.[1];
  assert.ok(encoded, "font must be bundled inline, not requested from a CDN or relative runtime file");
  assert.equal(createHash("sha256").update(Buffer.from(encoded, "base64")).digest("hex"), "39c9b64223561f56aaff6062a6f04063c4fc86809ad6768722c06614d977e1cc");
  assert.match(css, /\.budde\s+\.bd-font-brand\s*\{[^}]*font-family:\s*BuddeBrandQuicksand/);
  assert.doesNotMatch(css.match(/\.budde\s*\{[^}]*font-family:[^;]+/)?.[0] ?? "", /BuddeBrandQuicksand/);
  const license = await readFile(path.join(root, "src/ui/assets/Quicksand-OFL.txt"), "utf8");
  const readme = await readFile(path.join(root, "README.md"), "utf8");
  assert.ok(readme.includes(license.trim()), "the README distributed in the six-file ZIP must include the complete font license");
});
