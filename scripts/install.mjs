import { readFile, mkdir, copyFile, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const workspace = process.argv[2];
if (!workspace)
  throw new Error("用法：node scripts/install.mjs <思源工作空间根目录>");
const project = fileURLToPath(new URL("../", import.meta.url));
const root = await realpath(workspace);
const plugins = await realpath(path.join(root, "data", "plugins"));
const target = path.join(plugins, "siyuan-plugin-budde");
const source = path.join(project, "dist");
const manifest = JSON.parse(
  await readFile(path.join(source, "plugin.json"), "utf8"),
);
if (manifest.name !== "siyuan-plugin-budde")
  throw new Error("构建产物包名不匹配。");
try {
  const existing = JSON.parse(
    await readFile(path.join(target, "plugin.json"), "utf8"),
  );
  if (existing.name !== manifest.name)
    throw new Error("目标目录属于其他插件，已停止安装。");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
await mkdir(path.join(target, "i18n"), { recursive: true });
if (!path.resolve(await realpath(target)).startsWith(plugins + path.sep))
  throw new Error("目标目录超出思源插件目录，已停止安装。");
for (const file of [
  "index.js",
  "index.css",
  "plugin.json",
  "README.md",
  "THIRD_PARTY_NOTICES.md",
  "i18n/zh_CN.json",
  "i18n/en_US.json",
]) {
  await copyFile(path.join(source, file), path.join(target, file));
}
console.log(`Budde ${manifest.version} 已复制到 ${target}`);
console.log(
  "未修改插件启用设置。请在思源「设置 → 集市 → 已下载」中启用 Budde。",
);
