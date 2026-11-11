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
// Native dialog close events are queued after click. Observe their removal and
// the command's busy state before asserting results, rather than racing close.
const chooseAndSettle = async (page, name) => {
  await page.getByRole("button", { name, exact: true }).click();
  await page.waitForFunction(() => !document.querySelector("#modal-host")?.childElementCount
    && ![...document.querySelectorAll("#detail-save,#settings-controls")].some((node) => node.matches(":disabled")));
};

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
  assert.equal(await page.getByLabel("想法标题", { exact: true }).evaluate((node) => node.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Enter", code: "Enter", isComposing: true, bubbles: true, cancelable: true })
  )), false, "IME Enter must prevent the key's default action");
  await page.getByLabel("想法标题", { exact: true }).evaluate((node) => {
    node.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    node.form.requestSubmit();
  });
  assert.equal((await snapshot(page)).items.length, 17, "submit is also guarded during composition");
  await page.getByLabel("想法标题", { exact: true }).evaluate((node) => node.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true })));
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
  await chooseAndSettle(page, "继续编辑");
  assert.equal(await page.locator('[data-view="pool"]').getAttribute("aria-pressed"), "true");
  await tools();
  await page.getByRole("button", { name: "下次保存失败", exact: true }).click();
  await nav(page, "active");
  await chooseAndSettle(page, "保存后继续");
  assert.equal(await page.locator('[data-view="pool"]').getAttribute("aria-pressed"), "true");
  assert.equal(await field("下一步").inputValue(), "本地下一步，不应被筛选丢掉");
  assert.match(await page.locator("#detail-error").innerText(), /模拟/);
  await page.locator("#detail-error").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${output}/detail-failure.png` });
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
  await chooseAndSettle(page, "取消");
  assert.equal((await getItem()).paused, false);
  assert.notEqual((await getItem()).title, "保存修改和暂停一起发生");
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  await chooseAndSettle(page, "保存修改并执行");
  await page.getByRole("button", { name: "恢复推进", exact: true }).waitFor({ state: "visible" });
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
  await page.locator("#detail-error").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${output}/detail-conflict.png` });
  await page.getByRole("button", { name: "放弃草稿并读取最新版本", exact: true }).click();
  await chooseAndSettle(page, "继续编辑");
  assert.equal(await field("事项标题").inputValue(), "不能丢失的本地标题");
  await page.getByRole("button", { name: "放弃草稿并读取最新版本", exact: true }).click();
  await chooseAndSettle(page, "放弃并读取");
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
  await chooseAndSettle(page, "继续编辑");
  assert.equal(await field("事项标题").inputValue(), "Escape 也不能静默丢弃");
  await page.getByRole("button", { name: "关闭详情", exact: true }).click();
  await chooseAndSettle(page, "放弃修改");
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
  await chooseAndSettle(page, "取消");
  assert.equal((await getItem()).stageId, "article-1");
  assert.equal(await field("事项标题").inputValue(), "阶段操作也不能覆盖草稿");
  await page.getByRole("button", { name: "关闭详情", exact: true }).click();
  await chooseAndSettle(page, "放弃修改");
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

groups.settings = async (page, output) => {
  const ui = page.locator("#settings-dialog");
  const field = (name) => ui.getByLabel(name, { exact: true });
  const click = (name) => ui.getByRole("button", { name, exact: true }).click();
  const selectType = (id) => ui.locator(`[data-settings-type="${id}"]`).click();
  const stage = (id) => ui.locator(`[data-stage-row="${id}"]`);
  const open = async () => {
    await page.locator("header .more summary").click();
    await page.locator("header").getByRole("button", { name: "管理类型与阶段", exact: true }).click();
  };
  await open();
  await selectType("article");
  assert.equal(await ui.locator('[data-settings-type="article"]').evaluate((node) => node === document.activeElement), true, "type selection retains keyboard focus");
  await selectType("software");
  await click("编辑类型");
  await field("类型名称").fill("本地设置草稿");
  await page.evaluate(() => window.buddePrototype.refresh());
  assert.equal(await field("类型名称").inputValue(), "本地设置草稿");
  await field("类型名称").press("Escape");
  await chooseAndSettle(page, "继续编辑");
  assert.equal(await field("类型名称").inputValue(), "本地设置草稿");
  await ui.locator(".settings-demo summary").click();
  await click("模拟外部配置变化");
  await click("保存设置");
  assert.match(await ui.locator("#settings-status").innerText(), /版本/);
  assert.equal(await field("类型名称").inputValue(), "本地设置草稿");
  await click("重新读取设置");
  await chooseAndSettle(page, "继续编辑");
  assert.equal(await field("类型名称").inputValue(), "本地设置草稿");
  await click("重新读取设置");
  await chooseAndSettle(page, "放弃并读取");
  assert.equal(await ui.getByRole("button", { name: "重新读取设置", exact: true }).evaluate((node) => node === document.activeElement), true);
  await click("编辑类型");
  await field("类型名称").fill("软件 <b>字面文本</b>");
  await click("保存设置");
  assert.equal(await ui.locator('[data-settings-type="software"]').evaluate((node) => node === document.activeElement), true, "saving returns focus to the selected type");
  assert.equal((await snapshot(page)).types.find((type) => type.id === "software").name, "软件 <b>字面文本</b>");
  assert.equal(await ui.locator("b").count(), 0);

  const createType = async () => {
    await click("新建类型"); await field("类型名称").fill("自定义"); await click("保存设置");
    return (await snapshot(page)).types.at(-1);
  };
  const first = await createType();
  const second = await createType();
  assert.notEqual(first.id, second.id);
  await click("新增阶段");
  await field("阶段名称").fill("<b>检验</b>");
  await click("保存设置");
  let type = (await snapshot(page)).types.find((entry) => entry.id === second.id);
  const added = type.stages.at(-1);
  assert.equal(await stage(added.id).innerText().then((text) => text.includes("<b>检验</b>")), true);
  assert.equal(await ui.locator("b").count(), 0);
  await stage(added.id).getByRole("button", { name: "编辑", exact: true }).click();
  await field("阶段名称").fill("完成");
  await field("完成阶段").check();
  await click("保存设置");
  await stage(added.id).getByRole("button", { name: "上移阶段：完成", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction((id) => document.querySelector(`[data-stage-row="${id}"]`)?.parentElement.children[1]?.dataset.stageRow === id, added.id);
  assert.equal(await stage(added.id).getByRole("button", { name: "上移阶段：完成", exact: true }).evaluate((node) => node === document.activeElement), true, "reorder keeps the same action focused");
  await page.keyboard.press("Enter");
  await page.waitForFunction((id) => document.querySelector(`[data-stage-row="${id}"]`)?.parentElement.children[0]?.dataset.stageRow === id, added.id);
  assert.equal(await stage(added.id).getByRole("button", { name: "下移阶段：完成", exact: true }).evaluate((node) => node === document.activeElement), true, "at boundary, focus moves to the enabled action on the same stage");
  type = (await snapshot(page)).types.find((entry) => entry.id === second.id);
  assert.equal(type.stages[0].id, added.id);
  assert.equal(type.stages[0].completed, true);
  assert.equal(type.initialStageId, second.initialStageId);
  await click("编辑类型");
  await field("初始阶段").selectOption(added.id);
  await click("保存设置");
  type = (await snapshot(page)).types.find((entry) => entry.id === second.id);
  assert.equal(type.initialStageId, added.id);
  assert.equal(type.stages[0].completed, true);
  await click("删除类型");
  await click("确认删除类型");
  assert.equal((await snapshot(page)).types.some((entry) => entry.id === second.id), false);
  assert.equal((await snapshot(page)).types.some((entry) => entry.id === first.id), true);

  await click("关闭设置");
  assert.equal(await page.locator("header .more summary").evaluate((node) => node === document.activeElement), true);
  await nav(page, "board");
  await page.locator('#type-index [data-action="settings"]').click();
  await click("关闭设置");
  assert.equal(await page.locator('#type-index [data-action="settings"]').evaluate((node) => node === document.activeElement), true, "settings returns to its actual board opener");
  await page.evaluate(async (typeId) => {
    const result = await window.buddePrototype.client.execute({ kind: "item.create", title: "仅归档的类型引用", typeId, requestId: "archived-reference-request" });
    await window.buddePrototype.client.execute({ kind: "item.update", id: result.itemId, expectedVersion: 1, patch: { archived: true } });
    await window.buddePrototype.refresh();
  }, first.id);
  await open(); await selectType(first.id); await click("删除类型");
  assert.equal(await ui.getByRole("button", { name: "确认删除类型", exact: true }).isDisabled(), true);
  assert.match(await ui.locator("#migration-impact").innerText(), /1 个归档/);
  const deletionCode = await page.evaluate(async (id) => {
    const state = await window.buddePrototype.client.snapshot();
    try { await window.buddePrototype.client.execute({ kind: "type.delete", id, expectedRevision: state.revision }); }
    catch (error) { return error.code; }
  }, first.id);
  assert.equal(deletionCode, "IN_USE");
  await selectType("software");
  const before = await snapshot(page);
  await stage("software-2").getByRole("button", { name: "删除", exact: true }).click();
  assert.match(await ui.locator("#migration-impact").innerText(), /2 个事项.*1 个归档/);
  await click("确认删除并迁移");
  assert.equal((await snapshot(page)).revision, before.revision);
  assert.ok(await ui.locator("#settings-error").innerText());
  await field("迁移目标阶段").selectOption("software-1");
  await page.screenshot({ path: `${output}/settings-migration.png` });
  await click("确认删除并迁移");
  let after = await snapshot(page);
  for (const item of before.items.filter((entry) => entry.typeId === "software" && entry.stageId === "software-2")) {
    const next = after.items.find((entry) => entry.id === item.id);
    assert.equal(next.stageId, "software-1"); assert.equal(next.version, item.version + 1);
    assert.equal(next.archived, item.archived); assert.equal(next.paused, item.paused);
  }
  await stage("software-0").getByRole("button", { name: "删除", exact: true }).click();
  assert.match(await ui.locator("#migration-impact").innerText(), /初始阶段/);
  await field("迁移目标阶段").selectOption("software-1");
  await click("确认删除并迁移");
  after = await snapshot(page);
  assert.equal(after.types.find((entry) => entry.id === "software").initialStageId, "software-1");
  await page.screenshot({ path: `${output}/settings-lifecycle.png` });
  await click("编辑类型");
  await field("类型名称").fill("软件 · 最终设置");
  await click("关闭设置");
  await chooseAndSettle(page, "保存后继续");
  assert.equal(await ui.isVisible(), false);
  assert.equal((await snapshot(page)).types.find((entry) => entry.id === "software").name, "软件 · 最终设置");
  await page.getByLabel("新事项类型", { exact: true }).selectOption("software");
  await capture(page, "使用新初始阶段");
  assert.equal((await snapshot(page)).items[0].stageId, "software-1");
  assert.equal((await snapshot(page)).items[0].promoted, false);
  await page.locator("header .more summary").click();
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出 JSON", exact: true }).click();
  const download = await downloading;
  const exported = JSON.parse(await (await import("node:fs/promises")).readFile(await download.path(), "utf8"));
  assert.equal(exported.product, "Budde");
  assert.equal(exported.noteContentsIncluded, false);
  assert.deepEqual(exported.data, await snapshot(page));
  assert.match(await page.locator("#notice").innerText(), /不包含.*正文/);
};

groups.visual = async (page, output) => {
  const root = page.locator("#prototype");
  const pane = page.locator(".detail-pane");
  const id = "demo-software-3";
  const tools = async () => {
    if (await page.locator("#demo-tools").getAttribute("open") === null) await page.locator("#demo-tools summary").click();
  };
  const theme = async (value) => { await tools(); await page.getByRole("button", { name: `${value === "dark" ? "深" : "浅"}色演示`, exact: true }).click(); };
  const noOverflow = async () => {
    const sizes = await page.evaluate(() => ({ outer: document.documentElement.scrollWidth, viewport: innerWidth, root: document.querySelector("#prototype").clientWidth, content: document.querySelector("#prototype").scrollWidth }));
    assert.ok(sizes.outer <= sizes.viewport + 1, JSON.stringify(sizes));
    assert.ok(sizes.content <= sizes.root + 1, JSON.stringify(sizes));
  };
  const bounds = async (locator) => {
    const host = await root.boundingBox(); const child = await locator.boundingBox();
    assert.ok(child.x >= host.x - 1 && child.y >= host.y - 1 && child.x + child.width <= host.x + host.width + 1 && child.y + child.height <= host.y + host.height + 1, JSON.stringify({ host, child }));
  };
  for (const [width, height] of [[1440, 1000], [1024, 768], [720, 900], [480, 800]]) {
    await page.setViewportSize({ width, height });
    for (const value of ["light", "dark"]) {
      await theme(value);
      await nav(page, "board");
      await noOverflow();
      const contrasts = await page.evaluate(() => {
        const luminance = (color) => color.match(/[\d.]+/g).slice(0, 3).map(Number).map((n) => { n /= 255; return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4; }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
        const ratio = (a, b) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
        const body = getComputedStyle(document.body), muted = getComputedStyle(document.querySelector("#result-count")), primary = getComputedStyle(document.querySelector("#capture .primary"));
        return [ratio(body.color, body.backgroundColor), ratio(muted.color, body.backgroundColor), ratio(primary.color, primary.backgroundColor)];
      });
      assert.ok(contrasts.every((ratio) => ratio >= 4.5), JSON.stringify(contrasts));
      const scrolling = await page.locator("#collection").evaluate((node) => ({ mode: getComputedStyle(node).overflowX, width: node.clientWidth, content: node.scrollWidth }));
      assert.equal(scrolling.mode, "auto");
      if (width < 1200) assert.ok(scrolling.content > scrolling.width);
      await page.screenshot({ path: `${output}/${value}-${width}-board.png` });
      const beforeOpen = await page.locator("#collection").evaluate((node) => ({ x: node.scrollLeft, y: node.scrollTop }));
      await page.locator(`[data-open="${id}"]`).click();
      assert.equal(await page.locator("#detail-host").evaluate((node) => node.classList.contains("is-overlay")), width < 1200);
      await bounds(pane);
      if (width < 720) assert.ok(Math.abs((await pane.boundingBox()).width - width) <= 1);
      await noOverflow();
      await page.keyboard.press("Tab");
      assert.notEqual(await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle), "none");
      if (width < 1200) {
        const controls = pane.locator("button:enabled:visible,input:enabled:visible,select:enabled:visible,textarea:enabled:visible");
        await controls.last().focus(); await page.keyboard.press("Tab");
        assert.equal(await controls.first().evaluate((node) => node === document.activeElement), true);
        await page.keyboard.press("Shift+Tab");
        assert.equal(await controls.last().evaluate((node) => node === document.activeElement), true);
      }
      await page.screenshot({ path: `${output}/${value}-${width}-detail.png` });
      await page.keyboard.press("Escape");
      assert.equal(await pane.count(), 0);
      assert.equal(await page.locator(`[data-open="${id}"]`).evaluate((node) => node === document.activeElement), true);
      const afterClose = await page.locator("#collection").evaluate((node) => ({ x: node.scrollLeft, y: node.scrollTop }));
      assert.ok(Math.abs(beforeOpen.y - afterClose.y) <= 1);
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 }); await theme("light");
  await page.locator(`[data-open="${id}"]`).click();
  await page.getByLabel("事项标题", { exact: true }).fill("调整分屏宽度也保留草稿");
  await page.evaluate(() => { const node = document.querySelector("#prototype"); node.style.width = "480px"; node.style.height = "800px"; node.style.margin = "24px 0 0 16px"; });
  await page.waitForFunction(() => document.querySelector("#detail-host").classList.contains("is-overlay"));
  await bounds(pane); await noOverflow();
  assert.equal(await page.getByLabel("事项标题", { exact: true }).inputValue(), "调整分屏宽度也保留草稿");
  await page.keyboard.press("Escape");
  await bounds(page.locator(".guard-dialog"));
  assert.equal(await page.getByRole("button", { name: "继续编辑", exact: true }).evaluate((node) => node === document.activeElement), true);
  await chooseAndSettle(page, "继续编辑");
  await page.evaluate(() => { document.querySelector("#prototype").style.width = "1440px"; document.querySelector("#prototype").style.margin = "0"; });
  await page.waitForFunction(() => !document.querySelector("#detail-host").classList.contains("is-overlay"));
  assert.equal(await page.getByLabel("事项标题", { exact: true }).inputValue(), "调整分屏宽度也保留草稿");
  await page.keyboard.press("Escape"); await chooseAndSettle(page, "放弃修改");
  await page.evaluate(() => {
    const node = document.querySelector("#prototype"); node.style.width = "480px"; node.style.height = "800px"; node.style.margin = "24px 0 0 16px";
    for (const [token, value] of Object.entries({ "background": "rgb(39, 45, 51)", "surface": "rgb(47, 54, 60)", "on-background": "rgb(226, 231, 237)", "on-surface": "rgb(170, 180, 190)", "primary": "rgb(194, 164, 88)", "on-primary": "rgb(27, 32, 38)" })) document.documentElement.style.setProperty(`--b3-theme-${token}`, value);
    document.documentElement.style.setProperty("--b3-border-color", "rgb(74, 85, 96)");
    document.body.style.fontFamily = "Georgia, serif";
  });
  assert.equal(await page.locator("#capture-title").evaluate((node) => getComputedStyle(node).fontFamily), "Georgia, serif");
  assert.equal(await page.locator("#capture-title").evaluate((node) => getComputedStyle(node).backgroundColor), "rgba(0, 0, 0, 0)");
  assert.equal(await page.getByRole("button", { name: "记下来", exact: true }).evaluate((node) => getComputedStyle(node).backgroundColor), "rgb(194, 164, 88)");
  await page.locator("header .more summary").click();
  await page.locator("header").getByRole("button", { name: "管理类型与阶段", exact: true }).click();
  await bounds(page.locator("#settings-dialog"));
  assert.equal(await page.locator("#settings-dialog").evaluate((node) => getComputedStyle(node).backgroundColor), "rgb(39, 45, 51)");
  await page.locator('[data-stage-row="software-2"]').getByRole("button", { name: "删除", exact: true }).click();
  await page.screenshot({ path: `${output}/embedded-480-settings.png` });
  await page.getByRole("button", { name: "关闭设置", exact: true }).click();
  await page.evaluate(() => { const node = document.querySelector("#prototype"); node.style.cssText = ""; document.documentElement.style.cssText = ""; document.body.style.cssText = ""; });
  await page.evaluate(async () => {
    let state = await window.buddePrototype.client.snapshot();
    for (let n = 0; n < 2; n++) state = (await window.buddePrototype.client.execute({ kind: "stage.add", typeId: "software", name: "较长的同名阶段需要可辨认并保留内部滚动", expectedRevision: state.revision })).state;
    await window.buddePrototype.client.execute({ kind: "item.update", id: "demo-software-3", expectedVersion: 1, patch: { title: "很长的标题".repeat(80) } });
    await window.buddePrototype.refresh();
  });
  await page.setViewportSize({ width: 480, height: 800 });
  assert.equal(await page.locator("[data-stage-id]").count(), 6);
  await noOverflow();
  await page.locator("#collection").evaluate((node) => { node.scrollLeft = node.scrollWidth; });
  assert.ok(await page.locator("[data-stage-id]").last().isVisible());
  await page.screenshot({ path: `${output}/long-content-480.png` });
  await page.evaluate(async () => {
    const state = await window.buddePrototype.client.snapshot();
    await window.buddePrototype.client.execute({ kind: "type.update", id: "software", expectedRevision: state.revision, name: "长".repeat(120) });
    await window.buddePrototype.refresh();
  });
  for (const width of [1440, 1024, 480]) {
    await page.setViewportSize({ width, height: 900 });
    for (const withDetail of [false, true]) {
      if (withDetail) await page.locator('[data-open="demo-software-3"]').click();
      const searchBounds = await page.locator("#title-search").boundingBox();
      const panelBounds = await page.locator(".main-panel").boundingBox();
      assert.ok(searchBounds.width >= 100 && searchBounds.x >= panelBounds.x && searchBounds.x + searchBounds.width <= panelBounds.x + panelBounds.width + 1, `long type name must not clip search: ${width}/${withDetail}`);
      assert.equal(await page.locator("h1").evaluate((node) => node.scrollWidth <= node.clientWidth + 1), true);
      if (!withDetail || width >= 1200) await page.locator("#title-search").fill("");
      if (withDetail) {
        if (width === 1440) await page.screenshot({ path: `${output}/long-type-1440-detail.png` });
        await page.getByRole("button", { name: "关闭详情", exact: true }).click();
      }
    }
  }
  await page.evaluate(async () => {
    const state = await window.buddePrototype.client.snapshot();
    for (const item of state.items) await window.buddePrototype.client.execute({ kind: "item.update", id: item.id, expectedVersion: item.version, patch: { archived: true } });
    await window.buddePrototype.refresh();
  });
  await nav(page, "active"); assert.equal(await page.getByRole("heading", { name: "现在没有正在推进的事项", exact: true }).count(), 1);
  await page.getByRole("button", { name: "回到想法池", exact: true }).click();
  assert.equal(await page.getByRole("heading", { name: "先留下第一个想法", exact: true }).count(), 1);
  await page.getByRole("button", { name: "记一个想法", exact: true }).click();
  assert.equal(await page.getByLabel("想法标题", { exact: true }).evaluate((node) => node === document.activeElement), true);
  await page.reload();
  assert.equal((await snapshot(page)).items.length, 15);
  await page.goto(new URL("budde-workbench.html", page.url()).href);
  assert.equal((await snapshot(page)).items.length, 15);
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
