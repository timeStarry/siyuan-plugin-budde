import { build } from "esbuild";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

/** Isolated development fixture. Not included in the installable SiYuan plugin. */
export async function startPreview() {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const outdir = path.join(root, "artifacts", "preview");
  await mkdir(outdir, { recursive: true });
  await build({
    stdin: {
      contents: `
    import { BuddeService, MemoryStore } from './src/core/service';
    import { mountWorkbench } from './src/ui';
    import './src/ui/styles.css';
    const client = new BuddeService(new MemoryStore());
    window.buddeTest = { client, view: mountWorkbench(document.querySelector('#workbench'), client, {
      resolve: async target => { const id = target.match(/\\d{14}-[a-z0-9]{7}/)?.[0]; if(!id)throw Error('请输入有效思源链接'); return {target:'siyuan://blocks/'+id,title:'研究资料'}; },
      open: async target => { window.lastOpenedNote = target; }
    }) };
  `,
      resolveDir: root,
      loader: "ts",
    },
    bundle: true,
    outfile: path.join(outdir, "preview.js"),
    format: "iife",
    target: "chrome120",
  });
  await writeFile(
    path.join(outdir, "index.html"),
    `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Budde 开发验证</title><link rel="stylesheet" href="/preview.css"><style>html,body{margin:0;height:100%;font-family:system-ui,"Microsoft YaHei",sans-serif;background:#fafaf8;color:#252822}#workbench{height:100%}</style></head><body><main id="workbench"></main><script src="/preview.js"></script></body></html>`,
  );
  const server = createServer(async (request, response) => {
    const file = request.url?.split("?")[0] ?? "/";
    const allowed = {
      "/": ["index.html", "text/html; charset=utf-8"],
      "/preview.js": ["preview.js", "text/javascript; charset=utf-8"],
      "/preview.css": ["preview.css", "text/css; charset=utf-8"],
    };
    if (!allowed[file]) {
      response.writeHead(404).end();
      return;
    }
    try {
      const [name, contentType] = allowed[file];
      response.setHeader("Content-Type", contentType);
      response.end(await readFile(path.join(outdir, name)));
    } catch {
      response.writeHead(500).end("Preview unavailable");
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    close: () =>
      new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
}
