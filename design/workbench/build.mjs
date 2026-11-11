import { build } from "esbuild";
import { copyFile, mkdir } from "node:fs/promises";
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
  return output;
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  console.log(`Prototype built: ${await buildPrototype()}`);
}
