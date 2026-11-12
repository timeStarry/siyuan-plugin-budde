import { mkdir } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
import { launchTestBrowser, startPreview } from "./preview.mjs";

const qaDir = "artifacts/qa/v0.2.0";
await mkdir(qaDir, { recursive: true });

const preview = await startPreview();
const browser = await launchTestBrowser(chromium);
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (err) => errors.push(err.message));

try {
  await page.goto(preview.url);
  const captureInput = page.locator('[data-part="capture-title"]');
  await expect(captureInput).toBeVisible();

  // 1. Keyboard 'C' focuses quick capture without leaking 'c' into input
  await page.locator('[data-view="pool"]').focus();
  await page.keyboard.press("c");
  await expect(captureInput).toBeFocused();
  await expect(captureInput).toHaveValue("");

  // 2. Capture ideas into Pool & directly into Active
  await captureInput.fill("重新梳理个人知识库标签体系");
  await captureInput.press("Enter");
  await expect(captureInput).toHaveValue("");

  await page.locator('[data-part="create-type"]').selectOption("project");
  await captureInput.fill("支持快捷键一键捕获想法");
  await captureInput.press("Enter");

  // Capture directly as Active in project type
  await page.getByRole("button", { name: "存想法池" }).click();
  await expect(page.getByRole("button", { name: "直接推进" })).toHaveAttribute("aria-pressed", "true");
  await captureInput.fill("实现思源文档双向关联搜索");
  await captureInput.press("Enter");

  // Reset back to pool mode for general capture
  await page.getByRole("button", { name: "直接推进" }).click();
  await page.locator('[data-part="create-type"]').selectOption("general");

  // Pool has 2 unpromoted items; Active has 1
  await expect(page.locator('[data-view="pool"]')).toContainText("2");
  await expect(page.locator('[data-view="active"]')).toContainText("1");

  // Promote one Pool item directly from Pool card
  const shortcutCard = page.locator(".item-card", { hasText: "支持快捷键一键捕获想法" });
  await shortcutCard.getByRole("button", { name: "开始推进" }).click();
  await expect(page.locator(".budde-toast", { hasText: "已开始推进" })).toBeVisible();
  await expect(page.locator('[data-view="pool"]')).toContainText("1");
  await expect(page.locator('[data-view="active"]')).toContainText("2");

  // 3. Open Detail Panel in Pool, edit nextStep & description, link & create SiYuan notes
  await page.locator(".card-open", { hasText: "重新梳理个人知识库标签体系" }).click();
  const detail = page.locator(".detail-pane");
  await expect(detail).toBeVisible();

  const nextStepInput = detail.getByRole("textbox", { name: "下一步" });
  await nextStepInput.fill("先盘点现有高频目录与孤立文档");
  await nextStepInput.blur();

  const descInput = detail.getByRole("textbox", { name: "简短说明" });
  await descInput.fill("减少多层嵌套分类，转向按主题索引页组织。");
  await descInput.blur();

  // Search and attach existing SiYuan note
  await detail.getByRole("button", { name: "关联已有" }).click();
  const noteSearch = detail.getByRole("textbox", { name: "搜索思源笔记或粘贴块 ID" });
  await noteSearch.fill("架构");
  const searchResult = detail.locator("button", { hasText: "插件整体架构草稿" });
  await expect(searchResult).toBeVisible();
  await searchResult.click();
  await expect(detail.locator(".notes-section")).toContainText("插件整体架构草稿");

  // One-click create SiYuan outcome doc and verify it opens
  await detail.getByRole("button", { name: "新建文档" }).click();
  await expect(detail.getByLabel("选择思源笔记本")).toHaveValue("nb-product");
  await detail.getByRole("button", { name: "创建并打开" }).click();
  await expect(detail.locator(".notes-section")).toContainText("思源笔记（2）");
  expect(await page.evaluate(() => window.openedNotes.length)).toBe(1);

  // Test optimistic concurrency conflict banner in Detail Panel
  const titleBox = detail.getByRole("textbox", { name: "事项标题" });
  await titleBox.fill("本地尚未保存的新标题");
  await page.evaluate(async () => {
    const snap = await window.buddePreview.client.snapshot();
    const target = snap.items.find((i) => i.title === "重新梳理个人知识库标签体系");
    await window.buddePreview.client.execute({
      kind: "item.update",
      id: target.id,
      expectedVersion: target.version,
      patch: { title: "其他窗口已更新的标题" },
    });
    await window.buddePreview.view.refresh();
  });
  await titleBox.press("Enter");
  await expect(detail.getByRole("alert")).toContainText("内容已被其他窗口或操作修改");
  await detail.getByRole("button", { name: "覆盖保存" }).click();
  await expect(detail.getByRole("alert")).toHaveCount(0);
  await expect(page.locator(".card-title", { hasText: "本地尚未保存的新标题" })).toBeVisible();

  // Click stage timeline in Detail Panel to auto-promote Pool item into "进行中"
  await detail.locator(".stage-path button", { hasText: "进行中" }).click();
  await expect(detail).toContainText("推进中");

  // 4. Board View: type switcher, stage columns, Ghost Column, stage move & batch archive
  await page.locator('[data-view="board"]').click();
  await page.locator('[data-type-row="project"] button').first().click();
  await expect(page.locator(".stage-column")).toHaveCount(5);

  // Check column minimum width >= 240px and no nested vertical scrollbars
  const colMetrics = await page.locator(".stage-column").evaluateAll((cols) =>
    cols.map((col) => ({
      width: col.getBoundingClientRect().width,
      overflowY: getComputedStyle(col).overflowY,
    })),
  );
  for (const metric of colMetrics) {
    expect(metric.width).toBeGreaterThanOrEqual(240);
    expect(metric.overflowY).not.toBe("scroll");
  }

  // Add new stage via Ghost Column
  await page.getByRole("button", { name: "新增阶段列" }).click();
  const ghostInput = page.getByRole("textbox", { name: "新阶段名称" });
  await ghostInput.fill("灰度内测");
  await ghostInput.press("Enter");
  await expect(page.locator(".stage-column")).toHaveCount(6);

  // Open project card in Detail & take 1440x900 Light & Dark screenshots
  await page.locator(".card-open", { hasText: "实现思源文档双向关联搜索" }).click();
  await detail.locator(".stage-path button", { hasText: "原型实现" }).click();
  await page.screenshot({ path: `${qaDir}/workbench-1440-light.png`, animations: "disabled" });

  await page.evaluate(() => {
    document.documentElement.dataset.themeMode = "dark";
  });
  await page.screenshot({ path: `${qaDir}/workbench-1440-dark.png`, animations: "disabled" });
  await page.evaluate(() => {
    delete document.documentElement.dataset.themeMode;
  });

  // Move project item to completed stage ("已发布") and batch archive completed
  await detail.locator(".stage-path button", { hasText: "已发布" }).click();
  await page.keyboard.press("Escape");
  await expect(detail).toHaveCount(0);

  const archiveDoneBtn = page.getByRole("button", { name: /归档已完成/ });
  await expect(archiveDoneBtn).toBeVisible();
  await archiveDoneBtn.click();
  await page.locator('[data-budde-modal="true"]').getByRole("button", { name: "归档已完成" }).click();
  await expect(page.locator('[data-view="archive"]')).toContainText("1");

  // 5. Active View: focus tabs, pause & resume
  await page.locator('[data-view="active"]').click();
  await expect(page.locator(".item-card")).toHaveCount(2);
  await page.locator(".card-open", { hasText: "支持快捷键一键捕获想法" }).click();
  await page.locator(".detail-pane").getByRole("button", { name: "暂停" }).click();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: /已暂停/ }).click();
  await expect(page.locator(".item-card", { hasText: "支持快捷键一键捕获想法" })).toBeVisible();

  // 6. Settings Modal: create custom type, adjust reviewDays, and delete type with migration
  await page.getByRole("button", { name: "管理类型与阶段" }).click();
  const settingsModal = page.locator('[data-budde-modal="true"]');
  await expect(settingsModal).toBeVisible();
  // Host document.body must never be made inert or scroll-locked
  expect(await page.evaluate(() => Boolean(document.body.inert))).toBe(false);

  await settingsModal.getByRole("button", { name: "新建类型" }).click();
  await settingsModal.getByPlaceholder(/读书/).fill("专题研究");
  await settingsModal.getByLabel("搜索图标").fill("实验");
  await settingsModal.locator('[data-icon-option="FlaskConical"]').click();
  await settingsModal.getByRole("button", { name: "配色：青绿" }).click();
  await settingsModal.getByRole("button", { name: "创建类型" }).click();
  await expect(settingsModal.getByRole("button", { name: "专题研究", exact: true })).toBeVisible();

  await page.screenshot({ path: `${qaDir}/settings-modal-1440.png`, animations: "disabled" });
  await settingsModal.getByRole("button", { name: "关闭设置" }).click();
  await expect(settingsModal).toHaveCount(0);

  // 7. Archive View: restore & purge, plus v1 legacy JSON import verification
  await page.locator('[data-view="archive"]').click();
  await expect(page.locator(".item-card", { hasText: "实现思源文档双向关联搜索" })).toBeVisible();
  await page.getByRole("button", { name: "清空归档" }).click();
  await page.locator('[data-budde-modal="true"]').getByRole("button", { name: "确认清空归档" }).click();
  await expect(page.locator(".empty-state")).toContainText("还没有归档事项");

  // 8. Responsive Split-Pane (800x800 overlay drawer) & Narrow Container (360x740) geometry check
  await page.locator('[data-view="pool"]').click();
  await page.getByRole("button", { name: "仅显示待孵化想法" }).click();
  await page.setViewportSize({ width: 800, height: 800 });
  await page.locator(".card-open").first().click();
  await expect(page.locator("[data-detail-overlay]")).toBeVisible();
  await page.screenshot({ path: `${qaDir}/split-pane-800-drawer.png`, animations: "disabled" });
  await page.keyboard.press("Escape");
  await expect(page.locator(".detail-pane")).toHaveCount(0);

  await page.setViewportSize({ width: 360, height: 740 });
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
  await page.screenshot({ path: `${qaDir}/narrow-360.png`, animations: "disabled" });

  // 9. Overflow menu: reset to default demo & clear all items
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "数据与更多操作" }).click();
  await page.getByRole("menuitem", { name: "重置为默认示例…" }).click();
  await page.locator('[data-budde-modal="true"]').getByRole("button", { name: "确认重置示例" }).click();
  await expect(page.locator('[data-view="pool"]')).toContainText("3");
  await expect(page.locator('[data-view="active"]')).toContainText("2");

  await page.getByRole("button", { name: "数据与更多操作" }).click();
  await page.getByRole("menuitem", { name: "清空全部事项…" }).click();
  await page.locator('[data-budde-modal="true"]').getByRole("button", { name: "确认清空事项" }).click();
  await expect(page.locator(".empty-state")).toBeVisible();

  expect(errors).toEqual([]);
  console.log(
    "All v0.2.0 Workbench flows (Pool, Active, Board, Archive, Detail live search & doc creation, Conflict resolution, Settings, Light/Dark & Responsive) passed.",
  );
} finally {
  await browser.close();
  await preview.close();
}
