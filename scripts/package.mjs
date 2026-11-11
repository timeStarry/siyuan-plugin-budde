import { readFile, mkdir, writeFile } from "node:fs/promises";
import { deflateRawSync } from "node:zlib";
import { createHash } from "node:crypto";
// Dependency-free, reproducible ZIP: only this explicit runtime allowlist is shipped.
const files = ["index.js", "index.css", "plugin.json", "README.md", "i18n/zh_CN.json", "i18n/en_US.json"];
const manifest = JSON.parse(await readFile("dist/plugin.json", "utf8"));
if (manifest.name !== "siyuan-plugin-budde" || !/^[\w.-]+$/.test(manifest.version)) throw Error("Invalid plugin manifest");
function crc32(bytes) { let crc = 0xffffffff; for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); } return (crc ^ 0xffffffff) >>> 0; }
const entries = []; const directory = []; let offset = 0;
for (const file of files) {
  const name = Buffer.from(file); const source = await readFile(`dist/${file}`); const data = deflateRawSync(source); const crc = crc32(source);
  const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x800, 6); local.writeUInt16LE(8, 8); local.writeUInt16LE(33, 12); local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(source.length, 22); local.writeUInt16LE(name.length, 26);
  const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x800, 8); central.writeUInt16LE(8, 10); central.writeUInt16LE(33, 14); central.writeUInt32LE(crc, 16); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(source.length, 24); central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42);
  entries.push(local, name, data); directory.push(central, name); offset += local.length + name.length + data.length;
}
const central = Buffer.concat(directory); const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(central.length, 12); end.writeUInt32LE(offset, 16);
const zip = Buffer.concat([...entries, central, end]); const out = `artifacts/release/${manifest.name}-${manifest.version}.zip`;
await mkdir("artifacts/release", { recursive: true }); await writeFile(out, zip);
const sha256 = createHash("sha256").update(zip).digest("hex");
await writeFile(`${out}.sha256`, `${sha256}  ${out.split("/").at(-1)}\n`);
console.log(JSON.stringify({ out, bytes: zip.length, sha256, files }, null, 2));
