import test from "node:test";
import assert from "node:assert/strict";
import { SiYuanNotes, parseNoteId, tryParseNoteId } from "../src/platform/siyuan-notes";

const id = "20260101000000-abcdefg";

test("note targets only accept SiYuan IDs, block links and references", () => {
  for (const value of [id, `siyuan://blocks/${id}`, `((${id} '资料'))`, `((${id} "双引号"))`]) {
    assert.equal(parseNoteId(value), id);
    assert.equal(tryParseNoteId(value), id);
  }
  for (const value of ["https://example.com", `siyuan://blocks/${id}?x=1`, `${id}' OR 1=1`]) {
    assert.throws(() => parseNoteId(value));
    assert.equal(tryParseNoteId(value), null);
  }
});

test("open uses local session, validates target existence and opens only after successful resolution", async () => {
  const opened: string[] = [];
  const bridge = new SiYuanNotes(
    (value) => {
      opened.push(value);
    },
    async (url, options) => {
      assert.equal(url, "/api/query/sql");
      assert.equal(options?.credentials, "same-origin");
      assert.match(String(options?.body), new RegExp(id));
      return new Response(
        JSON.stringify({ code: 0, data: [{ id, content: "资料标题", hpath: "/笔记/资料标题" }] }),
      );
    },
  );
  const resolved = await bridge.resolve(id);
  assert.equal(resolved.title, "资料标题");
  assert.equal(resolved.hpath, "/笔记/资料标题");
  await bridge.open(id);
  assert.deepEqual(opened, [id]);

  const absent = new SiYuanNotes(
    () => assert.fail("Missing note must not open"),
    async () => new Response(JSON.stringify({ code: 0, data: [] })),
  );
  await assert.rejects(absent.open(id), /不存在/);
});

test("search, listNotebooks, createDoc and resolveMany escape SQL safely and normalize payloads", async () => {
  const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
  const createdId = "20260202120000-xyz1234";

  const bridge = new SiYuanNotes(
    () => undefined,
    async (url, options) => {
      const body = JSON.parse(String(options?.body ?? "{}"));
      requests.push({ url: String(url), body });
      if (url === "/api/notebook/lsNotebooks") {
        return new Response(
          JSON.stringify({
            code: 0,
            data: {
              notebooks: [
                { id: "nb-open", name: "日常笔记", closed: false },
                { id: "nb-closed", name: "归档库", closed: true },
              ],
            },
          }),
        );
      }
      if (url === "/api/filetree/createDocWithMd") {
        return new Response(JSON.stringify({ code: 0, data: createdId }));
      }
      return new Response(
        JSON.stringify({
          code: 0,
          data: [{ id, content: "检索结果", hpath: "/研发/检索结果", type: "d" }],
        }),
      );
    },
  );

  const results = await bridge.search("100%_test'quote");
  assert.equal(results.length, 1);
  assert.equal(results[0].isDoc, true);
  assert.match(String(requests[0].body.stmt), /100\\%\\_test''quote/);

  const notebooks = await bridge.listNotebooks();
  assert.deepEqual(notebooks, [{ id: "nb-open", name: "日常笔记" }]);

  const doc = await bridge.createDoc({
    notebookId: "nb-open",
    title: "新方案: 架构/设计?",
    markdown: "## 下一步\n\n验证接口",
  });
  assert.equal(doc.id, createdId);
  assert.equal(doc.title, "新方案 架构 设计");

  const map = await bridge.resolveMany([`siyuan://blocks/${id}`]);
  assert.equal(map[id]?.title, "检索结果");
});

test("destroy abort signal prevents host tab opening after delayed note lookup", async () => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let opened = 0;
  const bridge = new SiYuanNotes(
    () => {
      opened++;
    },
    async () => {
      await pending;
      return new Response(JSON.stringify({ code: 0, data: [{ id, content: "迟到的笔记" }] }));
    },
  );
  const controller = new AbortController();
  const opening = bridge.open(id, controller.signal);
  controller.abort();
  release();
  await opening;
  assert.equal(opened, 0);
});

test("SiYuanNotes reads doc markdown and extracts headings via getChildBlocks with SQL fallback", async () => {
  const headingId = "20261113120001-hd12345";
  const bridge = new SiYuanNotes(
    () => {},
    async (url, init) => {
      if (url === "/api/export/exportMdContent") {
        return new Response(
          JSON.stringify({
            code: 0,
            data: { hPath: "/研发/方案模板", content: "# 方案模板\n\n## 设想\n内容" },
          }),
        );
      }
      if (url === "/api/block/getChildBlocks") {
        return new Response(
          JSON.stringify({
            code: 0,
            data: [
              { id: headingId, type: "h", content: "<h2>设想</h2>" },
              { id: "20261113120002-pr12345", type: "p", content: "正文" },
            ],
          }),
        );
      }
      throw new Error(`unexpected ${url}: ${JSON.stringify(init)}`);
    },
  );

  const md = await bridge.readDocMarkdown(id);
  assert.equal(md.title, "方案模板");
  assert.match(md.markdown, /## 设想/);

  const headings = await bridge.getDocHeadings(id);
  assert.deepEqual(headings, [{ id: headingId, content: "设想" }]);

  // SQL fallback when getChildBlocks rejects
  const fallbackBridge = new SiYuanNotes(
    () => {},
    async (url) => {
      if (url === "/api/block/getChildBlocks") {
        return new Response(JSON.stringify({ code: -1, msg: "unsupported" }));
      }
      if (url === "/api/query/sql") {
        return new Response(
          JSON.stringify({
            code: 0,
            data: [{ id: headingId, content: "## 实施与打磨" }],
          }),
        );
      }
      throw new Error(`unexpected ${url}`);
    },
  );
  const fallbackHeadings = await fallbackBridge.getDocHeadings(id);
  assert.deepEqual(fallbackHeadings, [{ id: headingId, content: "实施与打磨" }]);
});
