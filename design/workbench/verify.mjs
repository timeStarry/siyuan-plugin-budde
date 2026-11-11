import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
import { buildPrototype } from "./build.mjs";

const groups = {};
const snapshot = (page) => page.evaluate(() => window.buddePrototype.client.snapshot());
const count = (page) => page.locator("[data-item-id]").count();
const capture = async (page, title) => {
  await page.getByLabel("想法标题", { exact: true }).fill(title);
  await page.getByRole("button", { name: "记下来", exact: true }).click();
  await page.getByRole("button", { name: "记下来", exact: true }).waitFor({ state: "visible" });
};
const nav = (page, view) => page.locator(`[data-view="${view}"]`).first().click();

groups.shell = async (page, output) => {
  assert.equal(await page.locator('[data-view="pool"]').getAttribute("aria-pressed"), "true");
  assert.equal(await count(page), 14);
  await page.getByRole("button", { name: "未开始推进", exact: true }).click();
  assert.equal(await count(page), 2);
  await page.getByRole("button", { name: "全部", exact: true }).click();
  await page.getByLabel("筛选类型", { exact: true }).selectOption("article");
  assert.equal(await count(page), 4);
  assert.equal(await page.getByLabel("新事项类型", { exact: true }).inputValue(), "general");
  await page.getByLabel("筛选类型", { exact: true }).selectOption("");
  await page.getByLabel("搜索事项标题", { exact: true }).fill("没有这个标题");
  assert.equal(await count(page), 0);
  assert.equal(await page.getByRole("button", { name: "清除筛选", exact: true }).isVisible(), true);
  await page.getByRole("button", { name: "清除筛选", exact: true }).click();
  assert.equal(await count(page), 14);
  await nav(page, "active");
  assert.equal(await count(page), 6);
  assert.equal(await page.getByRole("button", { name: "做一个简洁的阅读计时器", exact: true }).isVisible(), true);
  await nav(page, "archive");
  assert.equal(await count(page), 1);
  await nav(page, "board");
  await page.locator('[data-board-type="software"]').click();
  assert.equal(await count(page), 5);
  const paused = page.locator('[data-item-id="demo-software-1"]');
  assert.match(await paused.innerText(), /已暂停/);
  await page.screenshot({ path: `${output}/wide-board-shell.png` });

  await capture(page, "在看板里只留下标题");
  assert.equal(await count(page), 5);
  assert.match(await page.locator("#notice").innerText(), /想法池/);
  const newlyCreated = (await snapshot(page)).items.find((item) => item.title === "在看板里只留下标题");
  assert.equal(newlyCreated.typeId, "general");
  assert.equal(newlyCreated.promoted, false);
  assert.equal(newlyCreated.stageId, "general-0");
  assert.equal(await page.getByLabel("想法标题", { exact: true }).inputValue(), "");
  assert.equal(await page.getByLabel("想法标题", { exact: true }).evaluate((node) => node === document.activeElement), true);
  await capture(page, "下一条也可以接着记录");
  assert.equal((await snapshot(page)).items.length, 17);

  await page.getByLabel("想法标题", { exact: true }).fill("正在中文组词");
  await page.getByLabel("想法标题", { exact: true }).evaluate((node) => node.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Enter", code: "Enter", isComposing: true, bubbles: true, cancelable: true })
  ));
  assert.equal((await snapshot(page)).items.length, 17);
  assert.equal(await page.getByLabel("想法标题", { exact: true }).inputValue(), "正在中文组词");
  await page.getByLabel("想法标题", { exact: true }).fill("只创建一次");
  await page.locator("#capture").evaluate((node) => {
    node.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    node.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  await page.waitForFunction(() => document.querySelector("#capture-title").value === "");
  assert.equal((await snapshot(page)).items.filter((item) => item.title === "只创建一次").length, 1);

  await capture(page, "   ");
  assert.match(await page.locator("#error").innerText(), /标题/);
  assert.equal(await page.getByLabel("想法标题", { exact: true }).inputValue(), "   ");
  await capture(page, "长".repeat(501));
  assert.match(await page.locator("#error").innerText(), /标题/);
  assert.equal((await page.getByLabel("想法标题", { exact: true }).inputValue()).length, 501);
  await capture(page, "长".repeat(500));
  assert.equal(await page.getByLabel("想法标题", { exact: true }).inputValue(), "");
  const literal = '<img src=x onerror=alert(1)>';
  await capture(page, literal);
  await nav(page, "pool");
  assert.equal(await page.getByRole("button", { name: literal, exact: true }).isVisible(), true);
  assert.equal(await page.locator("img").count(), 0);

  const pending = page.locator('[data-item-id="demo-pool-1"]');
  await pending.getByRole("button", { name: "开始推进", exact: true }).click();
  const started = (await snapshot(page)).items.find((item) => item.id === "demo-pool-1");
  assert.equal(started.promoted, true);
  assert.equal(started.stageId, "general-0");
  await page.screenshot({ path: `${output}/wide-pool-shell.png` });
};

groups.detail = async (page, output) => {
  const id = "demo-software-3";
  const open = () => page.locator(`[data-open="${id}"]`).click();
  const field = (name) => page.getByLabel(name, { exact: true });
  const save = () => page.getByRole("button", { name: "保存更改", exact: true }).click();
  const getItem = async () => (await snapshot(page)).items.find((item) => item.id === id);
  const tools = async () => { if (await page.locator("#demo-tools").getAttribute("open") === null) await page.locator("#demo-tools summary").click(); };
  await open();
  assert.equal(await field("事项标题").evaluate((node) => node === document.activeElement), true);
  await field("下一步").fill("本地下一步，不应被筛选丢掉");
  await open();
  assert.equal(await field("下一步").inputValue(), "本地下一步，不应被筛选丢掉");
  await field("搜索事项标题").fill("找不到选中事项");
  assert.equal(await field("下一步").inputValue(), "本地下一步，不应被筛选丢掉");
  assert.match(await page.locator("#selected-hidden").innerText(), /当前结果/);
  await field("搜索事项标题").fill("");
  await nav(page, "active");
  await page.getByRole("button", { name: "继续编辑", exact: true }).click();
  assert.equal(await page.locator('[data-view="pool"]').getAttribute("aria-pressed"), "true");
  await tools();
  await page.getByRole("button", { name: "下次保存失败", exact: true }).click();
  await nav(page, "active");
  await page.getByRole("button", { name: "保存后继续", exact: true }).click();
  assert.equal(await page.locator('[data-view="pool"]').getAttribute("aria-pressed"), "true");
  assert.equal(await field("下一步").inputValue(), "本地下一步，不应被筛选丢掉");
  assert.match(await page.locator("#detail-error").innerText(), /模拟/);
  await save();
  assert.equal((await getItem()).nextStep, "本地下一步，不应被筛选丢掉");

  await field("事项类型").selectOption("article");
  assert.equal(await field("事项阶段").inputValue(), "");
  await save();
  assert.equal((await getItem()).typeId, "software");
  await field("事项阶段").selectOption("article-2");
  await field("简短说明").fill("这里是需要显式保存的说明。");
  await save();
  assert.equal((await getItem()).typeId, "article");
  assert.equal((await getItem()).stageId, "article-2");
  assert.equal((await getItem()).description, "这里是需要显式保存的说明。");

  await page.getByRole("button", { name: "关联笔记", exact: true }).click();
  await field("笔记目标").fill("javascript:alert(1)");
  await page.getByRole("button", { name: "添加关联", exact: true }).click();
  assert.match(await page.locator("#detail-error").innerText(), /思源/);
  assert.equal((await getItem()).links.length, 1);
  await field("笔记目标").fill("20260101000000-demo002");
  await field("关联角色").selectOption("outcome");
  await page.getByRole("button", { name: "添加关联", exact: true }).click();
  assert.equal(await page.locator("[data-note-open]").count(), 2);
  assert.equal((await getItem()).links.length, 1);
  await page.getByRole("button", { name: "移除关联：照片整理工具 · 界面草图", exact: true }).click();
  assert.equal((await getItem()).links[0].role, "reference");
  await save();
  assert.equal((await getItem()).links[0].role, "outcome");
  await page.locator("[data-note-open]").click();
  assert.match(await page.locator("#detail-message").innerText(), /不会打开真实/);

  await field("事项标题").fill("保存修改和暂停一起发生");
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  await page.getByRole("button", { name: "取消", exact: true }).click();
  assert.equal((await getItem()).paused, false);
  assert.notEqual((await getItem()).title, "保存修改和暂停一起发生");
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  await page.getByRole("button", { name: "保存修改并执行", exact: true }).click();
  assert.equal((await getItem()).paused, true);
  assert.equal((await getItem()).title, "保存修改和暂停一起发生");
  assert.equal((await getItem()).stageId, "article-2");
  await page.getByRole("button", { name: "归档事项", exact: true }).click();
  assert.equal((await getItem()).archived, true);
  await page.getByRole("button", { name: "移出归档", exact: true }).click();
  assert.equal((await getItem()).paused, true);
  assert.equal((await getItem()).stageId, "article-2");
  await page.getByRole("button", { name: "恢复推进", exact: true }).click();
  await page.getByRole("button", { name: "已复查", exact: true }).click();
  assert.equal((await getItem()).reviewedAt, "2026-11-11T00:00:00.000Z");

  await field("事项标题").fill("不能丢失的本地标题");
  await field("下一步").fill("不能丢失的本地下一步");
  await tools();
  await page.getByRole("button", { name: "模拟外部修改", exact: true }).click();
  assert.equal(await field("事项标题").inputValue(), "不能丢失的本地标题");
  await save();
  assert.match(await page.locator("#detail-status").innerText(), /版本/);
  assert.equal(await field("下一步").inputValue(), "不能丢失的本地下一步");
  assert.match((await getItem()).title, /外部修改/);
  await page.getByRole("button", { name: "放弃草稿并读取最新版本", exact: true }).click();
  await page.getByRole("button", { name: "继续编辑", exact: true }).click();
  assert.equal(await field("事项标题").inputValue(), "不能丢失的本地标题");
  await page.getByRole("button", { name: "放弃草稿并读取最新版本", exact: true }).click();
  await page.getByRole("button", { name: "放弃并读取", exact: true }).click();
  assert.match(await field("事项标题").inputValue(), /外部修改/);
  await page.screenshot({ path: `${output}/wide-detail.png` });
  const beforeBrokenLink = await getItem();
  await page.evaluate(async ({ id, version }) => {
    await window.buddePrototype.client.execute({ kind: "item.update", id, expectedVersion: version, patch: { links: [
      { id: "missing-note", target: "siyuan://blocks/20260101000000-missing", title: "失效的示例目标", role: "reference" },
    ] } });
    await window.buddePrototype.refresh();
  }, { id, version: beforeBrokenLink.version });
  const brokenVersion = (await getItem()).version;
  await page.locator("[data-note-open]").click();
  assert.ok(await page.locator("#detail-error").innerText());
  assert.equal((await getItem()).version, brokenVersion);
  assert.equal((await getItem()).links.length, 1);

  await field("事项标题").fill("Escape 也不能静默丢弃");
  await field("事项标题").press("Escape");
  await page.getByRole("button", { name: "继续编辑", exact: true }).click();
  assert.equal(await field("事项标题").inputValue(), "Escape 也不能静默丢弃");
  await page.getByRole("button", { name: "关闭详情", exact: true }).click();
  await page.getByRole("button", { name: "放弃修改", exact: true }).click();
  assert.equal(await page.locator(".detail-pane").count(), 0);
  assert.equal(await page.locator(`[data-open="${id}"]`).evaluate((node) => node === document.activeElement), true);

  await nav(page, "board");
  await page.locator('[data-board-type="article"]').click();
  const beforeDrag = await getItem();
  await page.locator(`[data-item-id="${id}"]`).dragTo(page.locator('[data-stage-id="article-1"] .stage-items'));
  assert.equal((await getItem()).stageId, "article-1");
  assert.equal((await getItem()).typeId, beforeDrag.typeId);
  assert.equal((await getItem()).paused, beforeDrag.paused);
  assert.equal((await getItem()).version, beforeDrag.version + 1);
  await open();
  await field("事项标题").fill("阶段操作也不能覆盖草稿");
  await page.locator(`[data-item-id="${id}"] summary`).click();
  await page.locator(`[data-stage-item="${id}"][data-stage-target="article-3"]`).click();
  await page.getByRole("button", { name: "取消", exact: true }).click();
  assert.equal((await getItem()).stageId, "article-1");
  assert.equal(await field("事项标题").inputValue(), "阶段操作也不能覆盖草稿");
  await page.getByRole("button", { name: "关闭详情", exact: true }).click();
  await page.getByRole("button", { name: "放弃修改", exact: true }).click();
  await page.locator(`[data-item-id="${id}"] summary`).focus();
  await page.locator(`[data-item-id="${id}"] summary`).press("Enter");
  await page.locator(`[data-stage-item="${id}"][data-stage-target="article-3"]`).focus();
  await page.locator(`[data-stage-item="${id}"][data-stage-target="article-3"]`).press("Enter");
  assert.equal((await getItem()).stageId, "article-3");
  await nav(page, "active");
  assert.equal(await page.locator(`[data-item-id="${id}"]`).count(), 0);

  await tools();
  await page.getByRole("button", { name: "下次响应丢失", exact: true }).click();
  await capture(page, "响应丢失后不重复创建");
  assert.equal(await field("想法标题").inputValue(), "响应丢失后不重复创建");
  assert.equal((await snapshot(page)).items.length, 16);
  await page.getByRole("button", { name: "记下来", exact: true }).click();
  assert.equal((await snapshot(page)).items.length, 16);
  assert.equal(await field("想法标题").inputValue(), "");
};

const chosen = process.argv.find((arg) => arg.startsWith("--group="))?.slice(8);
if (chosen && !groups[chosen]) throw new Error(`Unknown group: ${chosen}`);
const output = await buildPrototype();
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
const results = [];
try {
  for (const [name, run] of Object.entries(groups)) {
    if (chosen && chosen !== name) continue;
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    const errors = [];
    const network = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("dialog", async (dialog) => { errors.push(`Unexpected dialog: ${dialog.message()}`); await dialog.dismiss(); });
    page.on("request", (request) => { if (/^https?:/i.test(request.url())) network.push(request.url()); });
    await page.goto(pathToFileURL(`${output}/index.html`).href, { waitUntil: "load" });
    await page.waitForFunction(() => !!window.buddePrototype);
    await run(page, output);
    assert.deepEqual(errors, [], "No page errors or unexpected dialogs");
    assert.deepEqual(network, [], "Local prototype must not access the network");
    results.push({ group: name, passed: true, pageErrors: errors, networkRequests: network });
    console.log(`PASS ${name}`);
    await context.close();
  }
  await writeFile(`${output}/results.json`, JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));
} finally { await browser.close(); }
