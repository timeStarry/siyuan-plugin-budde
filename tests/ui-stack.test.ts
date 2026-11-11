import test from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";

const root = process.cwd();
const text = (file: string) => readFile(path.join(root, file), "utf8");

test("UI stack is installed locally and shadcn aliases point to owned components", async () => {
  const pkg = JSON.parse(await text("package.json"));
  for (const name of ["react", "react-dom", "lucide-react", "framer-motion", "@dnd-kit/core", "@dnd-kit/sortable", "@radix-ui/react-slot", "@radix-ui/react-dialog", "class-variance-authority", "clsx", "tailwind-merge"]) assert.ok(pkg.dependencies[name], name);
  assert.ok(pkg.devDependencies.tailwindcss);
  const exists = await access(path.join(root, "components.json")).then(() => true, () => false);
  assert.equal(exists, true, "shadcn config must exist before migration");
  const config = JSON.parse(await text("components.json"));
  assert.equal(config.tailwind.baseColor, "zinc");
  assert.equal(config.tailwind.prefix, "bd-");
  assert.equal(config.aliases.ui, "@/ui/components/ui");
});

test("Tailwind CSS compiles real utilities without global preflight or unprefixed utilities", async () => {
  const exists = await access(path.join(root, "scripts/css.mjs")).then(() => true, () => false);
  assert.equal(exists, true, "shared Tailwind build pipeline must exist");
  const { buildStyles } = await import(pathToFileURL(path.join(root, "scripts/css.mjs")).href);
  const css: string = await buildStyles({ raw: '<div class="bd-flex bd-min-w-[240px] bd-p-3.5 bd-gap-2.5 bd-tabular-nums bd-line-clamp-2 bd-bg-background"></div>' });
  assert.match(css, /\.budde\s+\.bd-flex\s*\{/);
  assert.match(css, /min-width:\s*240px/);
  assert.match(css, /padding:\s*0\.875rem/);
  assert.match(css, /gap:\s*0\.625rem/);
  assert.match(css, /--tw-numeric-spacing:\s*tabular-nums/);
  assert.match(css, /font-variant-numeric:[^;]*var\(--tw-numeric-spacing\)/);
  assert.match(css, /-webkit-line-clamp:\s*2/);
  assert.doesNotMatch(css, /(^|\n)\s*(html|body|\*,|button,)/);
  assert.doesNotMatch(css, /(^|\n)\.flex\s*\{/);
  for (const rgb of ["249 250 251", "243 244 246", "228 228 231"]) assert.ok(css.includes(rgb), rgb);
});
