import { build } from "esbuild";
import { mkdir, copyFile } from "node:fs/promises";
await mkdir("dist/i18n", { recursive: true });
await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  outfile: "dist/index.js",
  format: "cjs",
  platform: "node",
  target: "chrome120",
  external: ["siyuan", "node:*"],
  sourcemap: false,
  minify: false,
  charset: "utf8",
});
for (const file of ["plugin.json", "README.md"])
  await copyFile(file, `dist/${file}`);
for (const file of ["zh_CN.json", "en_US.json"])
  await copyFile(`i18n/${file}`, `dist/i18n/${file}`);
console.log(
  "Budde plugin built in dist/ (index.js, index.css, manifest and readme).",
);
