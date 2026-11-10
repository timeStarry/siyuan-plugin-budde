import { chromium, expect } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { startPreview } from "./preview.mjs";

const preview = await startPreview();
const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  acceptDownloads: true,
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const passed = [];
await mkdir("artifacts/qa", { recursive: true });
const snapshot = () => page.evaluate(() => window.buddeTest.client.snapshot());
const openDetails = async (title) => {
  await page.getByRole("button", { name: title, exact: true }).first().click();
  await expect(page.locator("[data-form=detail]")).toBeVisible();
};
const saveDetails = async () => {
  await page
    .locator("[data-form=detail]")
    .getByRole("button", { name: "保存修改", exact: true })
    .click();
  await expect(page.locator(".budde-draft-status")).toContainText("已保存");
};
try {
  await page.goto(preview.url);
  await expect(page.getByText("先留下一个标题", { exact: true })).toBeVisible();
  const capture = page.locator("[data-form=capture]");
  await capture.locator("[name=title]").fill("旅行照片整理工具");
  await capture.getByRole("button", { name: "记下来", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "旅行照片整理工具", exact: true }),
  ).toBeVisible();
  expect((await snapshot()).items[0].links).toHaveLength(0);
  passed.push("title-only capture without documents");

  await openDetails("旅行照片整理工具");
  await page.locator("[data-field=nextStep]").fill("先验证本地图片读取");
  await page
    .locator("[data-field=description]")
    .fill("先从一小批照片开始，不需要建立完整图库。");
  await saveDetails();
  await page.locator("[data-action=promote]").click();
  await expect
    .poll(async () => (await snapshot()).items[0].promoted)
    .toBe(true);
  await page.locator("[data-action=close]").click();
  await page.locator("[data-action=view][data-view=board]").click();
  await page.locator("[data-card-stage]").selectOption("general-2");
  await expect
    .poll(async () => (await snapshot()).items[0].stageId)
    .toBe("general-2");
  passed.push("promote, next step and stage selector");

  const item = page.locator("[data-item]").first();
  await item.dragTo(page.locator("[data-drop-stage=general-3]"));
  await expect
    .poll(async () => (await snapshot()).items[0].stageId)
    .toBe("general-3");
  await page.locator("[data-card-stage]").selectOption("general-1");
  await expect
    .poll(async () => (await snapshot()).items[0].stageId)
    .toBe("general-1");
  passed.push("drag stage forward and reopen via selector");

  await openDetails("旅行照片整理工具");
  await page.locator("[data-field=title]").fill("保留我的未保存标题");
  await page.evaluate(async () => {
    const { client, view } = window.buddeTest;
    const state = await client.snapshot();
    const item = state.items[0];
    await client.execute({
      kind: "item.update",
      id: item.id,
      expectedVersion: item.version,
      patch: { title: "另一个窗口的修改" },
    });
    await view.refresh();
  });
  await expect(page.locator("[data-field=title]")).toHaveValue(
    "保留我的未保存标题",
  );
  await page
    .locator("[data-form=detail]")
    .getByRole("button", { name: "保存修改", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("修改");
  await expect(page.locator("[data-field=title]")).toHaveValue(
    "保留我的未保存标题",
  );
  expect((await snapshot()).items[0].title).toBe("另一个窗口的修改");
  await page.locator("[data-action=reload]").click();
  await expect(page.locator("[data-field=title]")).toHaveValue(
    "另一个窗口的修改",
  );
  passed.push("refresh preserves dirty draft and stale save is rejected");

  const linkForm = page.locator("[data-form=link]");
  await linkForm.locator("[name=target]").fill("20260101000000-abcdefg");
  await page.evaluate(() => window.buddeTest.view.refresh());
  await expect(linkForm.locator("[name=target]")).toHaveValue(
    "20260101000000-abcdefg",
  );
  await linkForm.getByRole("button", { name: "添加关联", exact: true }).click();
  await saveDetails();
  await page.locator("[data-action=open-link]").click();
  await expect
    .poll(() => page.evaluate(() => window.lastOpenedNote))
    .toBe("siyuan://blocks/20260101000000-abcdefg");
  passed.push("existing note association and refresh-safe link input");

  await page.locator("[data-action=pause]").click();
  await expect.poll(async () => (await snapshot()).items[0].paused).toBe(true);
  await page.locator("[data-action=view][data-view=active]").click();
  await expect(
    page.getByText("暂时没有正在推进的事项", { exact: true }),
  ).toBeVisible();
  await page.locator("[data-action=pause]").click();
  await expect(
    page.getByRole("button", { name: "另一个窗口的修改", exact: true }),
  ).toBeVisible();
  await page.locator("[data-action=archive]").click();
  await expect
    .poll(async () => (await snapshot()).items[0].archived)
    .toBe(true);
  await page.locator("[data-action=view][data-view=pool]").click();
  await page.locator("[data-archive]").check();
  await expect(
    page.getByRole("button", { name: "另一个窗口的修改", exact: true }),
  ).toBeVisible();
  await page.locator("[data-action=archive]").click();
  await page.locator("[data-archive]").uncheck();
  await page.locator("[data-action=close]").click();
  passed.push("pause, resume, archive and restoration");

  await page.locator("[data-action=settings]").click();
  const settings = page.getByRole("dialog");
  await settings.locator("[data-form=stage-add] [name=name]").fill("准备复盘");
  await page.evaluate(() => window.buddeTest.view.refresh());
  await expect(
    settings.locator("[data-form=stage-add] [name=name]"),
  ).toHaveValue("准备复盘");
  await settings
    .locator("[data-form=stage-add]")
    .getByRole("button", { name: "添加阶段", exact: true })
    .click();
  await expect
    .poll(async () =>
      (await snapshot()).types[0].stages.some((s) => s.name === "准备复盘"),
    )
    .toBe(true);
  const firstStage = settings.locator(
    "[data-form=stage-edit][data-id=general-0]",
  );
  await firstStage.locator("[name=name]").fill("灵感");
  await firstStage.getByRole("button", { name: "保存", exact: true }).click();
  await expect
    .poll(async () => (await snapshot()).types[0].stages[0].name)
    .toBe("灵感");
  await settings.locator("[data-action=close-settings]").click();
  passed.push("lifecycle editing and settings input survives refresh");

  await page.locator("[data-action=settings]").click();
  await settings
    .locator("[data-form=type-name] [name=name]")
    .fill("本地未保存的类型名");
  await page.evaluate(async () => {
    const { client, view } = window.buddeTest;
    const state = await client.snapshot();
    await client.execute({
      kind: "type.update",
      id: "general",
      name: "其他窗口的类型名",
      expectedRevision: state.revision,
    });
    await view.refresh();
  });
  await settings
    .locator("[data-form=type-name]")
    .getByRole("button", { name: "保存名称", exact: true })
    .click();
  await expect(settings.getByRole("alert")).toContainText("修改");
  await expect(
    settings.locator("[data-form=type-name] [name=name]"),
  ).toHaveValue("本地未保存的类型名");
  expect((await snapshot()).types[0].name).toBe("其他窗口的类型名");
  await settings.locator("[data-action=reload-settings]").click();
  await expect(
    settings.locator("[data-form=type-name] [name=name]"),
  ).toHaveValue("其他窗口的类型名");
  await settings.locator("[data-action=close-settings]").click();
  passed.push("settings rejects stale configuration and preserves local edits");

  const downloadPromise = page.waitForEvent("download");
  await page.locator("[data-action=export]").click();
  const download = await downloadPromise;
  await download.saveAs("artifacts/qa/export.json");
  const exported = JSON.parse(
    await readFile("artifacts/qa/export.json", "utf8"),
  );
  expect(exported.data.items).toHaveLength(1);
  expect(exported.noteContentsIncluded).toBe(false);
  passed.push("complete JSON export");

  const retryPage = await context.newPage();
  await retryPage.goto(preview.url);
  await expect(
    retryPage.getByText("先留下一个标题", { exact: true }),
  ).toBeVisible();
  await retryPage.evaluate(() => {
    const client = window.buddeTest.client,
      original = client.execute.bind(client);
    let first = true;
    client.execute = async (command) => {
      const result = await original(command);
      if (first && command.kind === "item.create") {
        first = false;
        throw Error("模拟保存响应丢失，请重试");
      }
      return result;
    };
  });
  await retryPage
    .locator("[data-form=capture] [name=title]")
    .fill("响应丢失后重试的想法");
  await retryPage
    .locator("[data-form=capture]")
    .getByRole("button", { name: "记下来", exact: true })
    .click();
  await expect(retryPage.getByRole("alert")).toContainText("响应丢失");
  await expect(
    retryPage.locator("[data-form=capture] [name=title]"),
  ).toHaveValue("响应丢失后重试的想法");
  await retryPage
    .locator("[data-form=capture]")
    .getByRole("button", { name: "记下来", exact: true })
    .click();
  await expect(
    retryPage.locator("[data-form=capture] [name=title]"),
  ).toHaveValue("");
  expect(
    await retryPage.evaluate(
      async () => (await window.buddeTest.client.snapshot()).items.length,
    ),
  ).toBe(1);
  await retryPage.close();
  passed.push("lost creation response retry produces one item");

  await page.locator("[data-action=view][data-view=board]").click();
  await page.screenshot({
    path: "artifacts/qa/desktop-board.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("[data-action=view][data-view=pool]").click();
  await openDetails("另一个窗口的修改");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/qa/mobile-detail.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addStyleTag({
    content:
      ".budde{--b3-theme-background:#181818;--b3-theme-on-background:#dededb;--b3-theme-on-surface:#a6aaa2;--b3-border-color:#343832;--b3-theme-surface:#272727;--b3-theme-primary:#8dbd9b;--b3-theme-on-primary:#182b1e;--b3-theme-primary-lightest:#26392d}",
  });
  await page.screenshot({
    path: "artifacts/qa/dark-detail.png",
    fullPage: true,
  });
  passed.push("desktop, narrow viewport and dark theme visual captures");
  expect(errors).toEqual([]);
  await writeFile(
    "artifacts/qa/results.json",
    JSON.stringify({ passed, errors }, null, 2),
  );
  console.log(JSON.stringify({ passed, errors }, null, 2));
} catch (error) {
  await page.screenshot({ path: "artifacts/qa/failure.png", fullPage: true });
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
  await preview.close();
}
