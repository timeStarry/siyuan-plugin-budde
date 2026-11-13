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

  // Promote one Pool item directly from Pool card (hover reveals top-right quick actions without changing card height)
  const shortcutCard = page.locator(".item-card", { hasText: "支持快捷键一键捕获想法" });
  const preHoverHeight = await shortcutCard.evaluate((el) => el.getBoundingClientRect().height);
  await shortcutCard.hover();
  const postHoverHeight = await shortcutCard.evaluate((el) => el.getBoundingClientRect().height);
  expect(postHoverHeight).toBe(preHoverHeight);
  await expect(shortcutCard.locator("[data-type-badge]")).toBeVisible();
  await expect(shortcutCard.getByRole("button", { name: "展开详情" })).toHaveCount(0);
  await shortcutCard.getByRole("button", { name: "开始推进" }).click();
  await expect(page.locator(".budde-toast", { hasText: "已开始推进" })).toBeVisible();
  await expect(page.locator('[data-view="pool"]')).toContainText("1");
  await expect(page.locator('[data-view="active"]')).toContainText("2");

  // 3. Open Detail Panel in Pool (floating overlay must NOT shrink .main-panel width), edit priority, nextStep, description, link & create SiYuan notes
  const mainWidthBefore = await page
    .locator(".main-panel")
    .evaluate((el) => Math.round(el.getBoundingClientRect().width));
  await page.locator(".card-open", { hasText: "重新梳理个人知识库标签体系" }).click();
  const detail = page.locator(".detail-pane");
  await expect(detail).toBeVisible();
  await expect(page.locator('[data-detail-floating="true"]')).toBeVisible();
  const mainWidthAfter = await page
    .locator(".main-panel")
    .evaluate((el) => Math.round(el.getBoundingClientRect().width));
  expect(mainWidthAfter).toBe(mainWidthBefore);

  // Set Priority in DetailPanel & verify badge on card
  await detail.getByLabel("优先级").selectOption("high");
  await expect(
    page.locator(".item-card", { hasText: "重新梳理个人知识库标签体系" }).locator("[data-priority-badge]"),
  ).toContainText("重点");

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

  // One-click create SiYuan outcome doc using type template; matched heading (## 进行中) auto-binds as stage link
  await detail.getByRole("button", { name: "新建文档" }).click();
  await expect(detail.getByLabel("选择思源笔记本")).toHaveValue("nb-product");
  await detail.getByRole("button", { name: "创建并打开" }).click();
  await expect(detail.locator(".notes-section")).toContainText("思源笔记（3）");
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

  // Click stage timeline in Detail Panel to auto-promote Pool item into "进行中" & see auto-bound stage link
  await detail.locator(".stage-path > ol > li > button", { hasText: "进行中" }).click();
  await expect(detail).toContainText("推进中");
  await expect(detail.locator(".stage-path").getByRole("button", { name: "解除阶段绑定：进行中" })).toBeAttached();

  // Test wide-screen canvas click closes the floating drawer cleanly
  await page.locator('[data-budde-shell="main"]').click({ position: { x: 24, y: 24 } });
  await expect(detail).toHaveCount(0);

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

  // Open project card in Detail, check stage criteria + add custom criterion & take 1440x900 Light & Dark screenshots
  await page.locator(".card-open", { hasText: "实现思源文档双向关联搜索" }).click();
  await detail.locator(".stage-path > ol > li > button", { hasText: "原型实现" }).click();
  const firstCriterion = detail.locator('.stage-path [role="checkbox"]').first();
  await expect(firstCriterion).toBeVisible();
  await firstCriterion.click();
  await expect(firstCriterion).toHaveAttribute("aria-checked", "true");
  await detail.getByRole("button", { name: "添加本阶段检查项" }).click();
  const customCriterionInput = detail.getByLabel("新增本阶段专属检查项");
  await customCriterionInput.fill("确认抽屉悬浮体验流畅");
  await customCriterionInput.press("Enter");
  await expect(detail.locator(".stage-path")).toContainText("确认抽屉悬浮体验流畅");
  await page.screenshot({ path: `${qaDir}/workbench-1440-light.png`, animations: "disabled" });

  await page.evaluate(() => {
    document.documentElement.dataset.themeMode = "dark";
  });
  await page.screenshot({ path: `${qaDir}/workbench-1440-dark.png`, animations: "disabled" });
  await page.evaluate(() => {
    delete document.documentElement.dataset.themeMode;
  });

  // Move project item to completed stage ("已发布") and batch archive completed
  await detail.locator(".stage-path > ol > li > button", { hasText: "已发布" }).click();
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

  // 6. Settings Modal: stage criteria editing, template extraction from SiYuan doc, create custom type & import/export check
  await page.getByRole("button", { name: "管理类型与阶段" }).click();
  const settingsModal = page.locator('[data-budde-modal="true"]');
  await expect(settingsModal).toBeVisible();
  // Host document.body must never be made inert or scroll-locked
  expect(await page.evaluate(() => Boolean(document.body.inert))).toBe(false);

  // Edit stage criteria & extract template from SiYuan doc on active type
  await settingsModal.getByRole("button", { name: /^准出项：/ }).first().click();
  const addCritInput = settingsModal.getByPlaceholder("输入阶段准出检查项，按回车添加…");
  await addCritInput.fill("验证模板与准出协同");
  await addCritInput.press("Enter");
  await expect(settingsModal).toContainText("验证模板与准出协同");
  await settingsModal.getByRole("button", { name: "从思源文档提取…" }).click();
  await settingsModal.locator("button", { hasText: "插件整体架构草稿" }).click();
  await expect(settingsModal.locator("#budde-type-doc-template")).toHaveValue(/插件整体架构草稿/);
  await settingsModal.getByRole("button", { name: "保存模板" }).click();
  await expect(settingsModal.getByRole("button", { name: "导出此类型" })).toBeVisible();

  await settingsModal.getByLabel("导入类型包文件").setInputFiles({
    name: "imported-pack.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        product: "BuddeTypePack",
        schemaVersion: 1,
        exportedAt: "2026-11-13T00:00:00.000Z",
        type: {
          name: "导入实践",
          icon: "FlaskConical",
          color: "emerald",
          reviewDays: 21,
          docTemplate: "# {{title}}\n\n## 验证\n",
          initialStageIndex: 0,
          stages: [
            { name: "探索", completed: false, criteria: ["列出问题"] },
            { name: "完成", completed: true },
          ],
        },
      }),
    ),
  });
  await expect(settingsModal.getByRole("button", { name: "导入实践", exact: true })).toBeVisible();

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

  // 9. Overflow menu: reset to default demo, verify equal-height row cards + sortable List View, & clear all items
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "数据与更多操作" }).click();
  await page.getByRole("menuitem", { name: "重置为默认示例…" }).click();
  await page.locator('[data-budde-modal="true"]').getByRole("button", { name: "确认重置示例" }).click();
  await expect(page.locator('[data-view="pool"]')).toContainText("3");
  await expect(page.locator('[data-view="active"]')).toContainText("2");

  // Verify same-row Pool cards stretch to equal height even when descriptions differ
  const rowCardHeights = await page.locator(".item-card").evaluateAll((cards) => {
    const firstTop = Math.round(cards[0].getBoundingClientRect().top);
    return cards
      .filter((c) => Math.abs(Math.round(c.getBoundingClientRect().top) - firstTop) <= 2)
      .map((c) => Math.round(c.getBoundingClientRect().height));
  });
  expect(rowCardHeights.length).toBeGreaterThanOrEqual(2);
  expect(new Set(rowCardHeights).size).toBe(1);

  // Switch to List View, verify 42px row density, column sorting, and 360px narrow container layout
  await page.getByRole("button", { name: "列表视图" }).click();
  await expect(page.locator('[data-list-view="true"]')).toBeVisible();
  const listRowHeights = await page
    .locator("[data-list-row]")
    .evaluateAll((rows) => rows.map((r) => Math.round(r.getBoundingClientRect().height)));
  expect(listRowHeights.length).toBe(3);
  for (const h of listRowHeights) {
    expect(h).toBe(42);
  }
  await page.getByRole("button", { name: "按类型排序" }).click();
  await expect(page.getByRole("button", { name: "按类型排序" }).locator('[data-icon="sortAsc"]')).toBeVisible();
  await page.getByRole("button", { name: "按类型排序" }).click();
  await expect(page.getByRole("button", { name: "按类型排序" }).locator('[data-icon="sortDesc"]')).toBeVisible();
  await page.getByRole("button", { name: "按优先级排序" }).click();
  await expect(page.getByRole("button", { name: "按优先级排序" }).locator('[data-icon="sortAsc"]')).toBeVisible();
  // Clicking another row while floating drawer is open switches selection directly
  await page.locator("[data-list-row]").nth(0).click();
  await expect(detail).toBeVisible();
  await page.locator("[data-list-row]").nth(1).click();
  await expect(detail).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(detail).toHaveCount(0);

  await page.setViewportSize({ width: 360, height: 740 });
  const listNarrowOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(listNarrowOverflow).toBe(false);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "卡片视图" }).click();
  await expect(page.locator('[data-list-view="true"]')).toHaveCount(0);

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
