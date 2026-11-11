import { build } from "esbuild";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const source = path.dirname(fileURLToPath(import.meta.url));
export async function buildPrototype() {
  const output = path.resolve(source, "../../artifacts/design/workbench");
  await mkdir(output, { recursive: true });
  await build({ entryPoints: [path.join(source, "main.ts")], outfile: path.join(output, "prototype.js"),
    bundle: true, format: "iife", platform: "browser", target: "chrome120", sourcemap: false });
  await copyFile(path.join(source, "index.html"), path.join(output, "index.html"));
  await copyFile(path.join(source, "styles.css"), path.join(output, "prototype.css"));
  const [html, css, script] = await Promise.all(["index.html", "prototype.css", "prototype.js"].map((file) => readFile(path.join(output, file), "utf8")));
  const standalone = html.replace('<link rel="stylesheet" href="./prototype.css">', () => `<style>${css}</style>`)
    .replace('<script defer src="./prototype.js"></script>', "")
    .replace("</body>", () => `<script>${script.replace(/<\/script/gi, "<\\/script")}</script></body>`);
  await writeFile(path.join(output, "budde-workbench.html"), standalone);
  return output;
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  console.log(`Prototype built: ${await buildPrototype()}`);
}
