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
