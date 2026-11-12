import { build } from "esbuild";
import { buddeCssPlugin } from "./css.mjs";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

/** Cross-platform Chromium launcher: tries local Chrome, then Edge, then Playwright Chromium. */
export async function launchTestBrowser(chromium) {
  for (const options of [
    { channel: "chrome", headless: true },
    { channel: "msedge", headless: true },
    { headless: true },
  ]) {
    try {
      return await chromium.launch(options);
    } catch {
      // try next browser channel
    }
  }
  throw new Error("Unable to launch Chrome, Edge, or Playwright Chromium for UI verification.");
}

/** Isolated development fixture. Not included in the installable SiYuan plugin. */
export async function startPreview() {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const outdir = path.join(root, "artifacts", "preview");
  await mkdir(outdir, { recursive: true });

  await build({
    stdin: {
      contents: `
        import { BuddeService, MemoryStore } from './src/core/service';
        import { mountWorkbench, mountQuickCapture } from './src/ui';
        import './src/ui/styles.css';

        const syntheticDocs = [
          {
            id: '20260101100000-archdoc',
            title: '插件整体架构草稿',
            hpath: '/研发笔记/插件整体架构草稿',
            isDoc: true,
          },
          {
            id: '20260102153000-uxnotes',
            title: '看板与想法池交互调研',
            hpath: '/产品思考/看板与想法池交互调研',
            isDoc: true,
          },
          {
            id: '20260103091500-refblk1',
            title: '关键设计约束摘录段落',
            hpath: '/产品思考/看板与想法池交互调研',
            isDoc: false,
          },
        ];

        const notebooks = [
          { id: 'nb-product', name: '产品与研发' },
          { id: 'nb-life', name: '日常随笔' },
        ];

        let docSeq = 10;
        window.openedNotes = [];

        const store = new MemoryStore();
        const client = new BuddeService(store);

        const notes = {
          resolve: async (target) => {
            const id = target.match(/\\d{14}-[a-z0-9]{7}/)?.[0];
            if (!id) throw new Error('请输入有效的思源块 ID、思源链接或块引用。');
            const hit = syntheticDocs.find((d) => d.id === id);
            return {
              id,
              target: 'siyuan://blocks/' + id,
              title: hit ? hit.title : '思源块 ' + id.slice(-7),
              hpath: hit?.hpath,
            };
          },
          search: async (query) => {
            const q = (query || '').trim().toLowerCase();
            if (!q) return syntheticDocs.filter((d) => d.isDoc);
            const idMatch = q.match(/\\d{14}-[a-z0-9]{7}/)?.[0];
            if (idMatch) {
              const exact = syntheticDocs.find((d) => d.id === idMatch);
              return exact
                ? [{ ...exact, target: 'siyuan://blocks/' + exact.id }]
                : [{ id: idMatch, target: 'siyuan://blocks/' + idMatch, title: '直接解析块', isDoc: false }];
            }
            return syntheticDocs
              .filter((d) => d.title.toLowerCase().includes(q) || (d.hpath || '').toLowerCase().includes(q))
              .map((d) => ({ ...d, target: 'siyuan://blocks/' + d.id }));
          },
          listNotebooks: async () => notebooks,
          createDoc: async ({ notebookId, title }) => {
            docSeq += 1;
            const id = '202611121200' + String(docSeq).padStart(2, '0') + '-created';
            const nb = notebooks.find((n) => n.id === notebookId) || notebooks[0];
            const hpath = '/' + nb.name + '/' + title;
            const entry = { id, title, hpath, isDoc: true };
            syntheticDocs.unshift(entry);
            return { id, target: 'siyuan://blocks/' + id, title, hpath };
          },
          resolveMany: async (targets) => {
            const map = {};
            for (const t of targets) {
              const id = t.replace('siyuan://blocks/', '');
              const hit = syntheticDocs.find((d) => d.id === id);
              if (hit) map[id] = { title: hit.title, hpath: hit.hpath };
            }
            return map;
          },
          open: async (target) => {
            window.openedNotes.push(target);
          },
        };

        const view = mountWorkbench(document.querySelector('#workbench'), client, notes);
        window.buddePreview = {
          store,
          client,
          notes,
          mountWorkbench,
          mountQuickCapture,
          view,
        };
      `,
      resolveDir: root,
      loader: "ts",
    },
    bundle: true,
    outfile: path.join(outdir, "preview.js"),
    format: "iife",
    target: "chrome120",
    plugins: [buddeCssPlugin()],
    define: { "process.env.NODE_ENV": '"production"' },
  });

  await writeFile(
    path.join(outdir, "index.html"),
    `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Budde 工作台验证</title>
  <link rel="stylesheet" href="/preview.css">
  <style>
    html, body {
      margin: 0;
      height: 100%;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
      background: #f9fafb;
      color: #18181b;
    }
    html[data-theme-mode="dark"], html[data-theme-mode="dark"] body {
      background: #09090b;
      color: #fafafa;
    }
    #workbench { height: 100%; width: 100%; }
  </style>
</head>
<body>
  <main id="workbench"></main>
  <script src="/preview.js"></script>
</body>
</html>`,
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
