import { mkdir, readFile } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
import { launchTestBrowser, startPreview } from "./preview.mjs";

// Built CJS in a browser DOM with a synthetic SiYuan host environment.
const preview = await startPreview();
const browser = await launchTestBrowser(chromium);
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

try {
  await page.goto(preview.url);
  await expect(page.locator('[data-part="capture-title"]')).toBeEnabled();
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.evaluate(() => {
    // Emulate SiYuan desktop global CSS (`base.*.css`) including:
    // - global & high-specificity container/dialog/path SVG fill rules
    // - `input[type=search] { box-sizing: content-box; -webkit-appearance: textfield }` (specificity 0,1,1)
    // - form control, link, dialog, and scrollbar global rules
    document.body.classList.add("layout-tab-container");
    const style = document.createElement("style");
    style.id = "synthetic-siyuan-svg";
    style.textContent = [
      "svg { fill: currentColor; display: inline-block; }",
      ".layout-tab-container svg, .b3-dialog svg, html[data-theme-mode] svg { fill: currentColor; }",
      ".layout-tab-container svg path, .layout-tab-container svg circle, .layout-tab-container svg rect { fill: currentColor; }",
      "button, input, select, textarea { margin: 0; font-size: 100%; vertical-align: middle; outline: none; }",
      "button, input { line-height: normal; }",
      "button, input[type=button], input[type=reset], input[type=submit] { cursor: pointer; -webkit-appearance: button; }",
      "input[type=search] { box-sizing: content-box; -webkit-appearance: textfield; }",
      "a { outline: 0; text-decoration: underline; color: #3575f0; }",
      "::-webkit-scrollbar-thumb { box-sizing: content-box; border: 4px solid transparent; box-shadow: inset 0 0 5px 5px rgba(0,0,0,0.2); }",
      ".b3-dialog { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 16px; }",
      ".b3-dialog__scrim { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.45); }",
      ".b3-dialog__container { position: relative; background: #fff; border: 1px solid #e4e4e7; border-radius: 12px; box-shadow: 0 12px 32px rgba(0,0,0,0.2); display: flex; flex-direction: column; }",
      ".b3-dialog__body { overflow: auto; flex: 1; display: flex; flex-direction: column; }",
      ".fn__none { display: none !important; }",
    ].join("\n");
    document.head.prepend(style);

    const hostIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    hostIcon.dataset.hostTestIcon = "";
    hostIcon.style.cssText =
      "color:rgb(12,34,56);position:fixed;width:16px;height:16px;bottom:0;left:0";
    document.body.append(hostIcon);
  });

  await page.evaluate(
    ({ code, css }) => {
      window.buddePreview.view.destroy();
      document.querySelector('link[href="/preview.css"]').remove();
      const style = document.createElement("style");
      style.textContent = css;
      document.head.append(style);

      const registrations = { tabs: [], commands: [], topbars: [], opened: [], icons: [], dialogs: 0 };
      window.hostRegistrations = registrations;

      class Plugin {
        constructor() {
          this.name = "siyuan-plugin-budde";
          this.app = {};
          this.eventBus = { on() {}, off() {} };
        }
        addIcons(svg) {
          registrations.icons.push(svg);
        }
        addTab(options) {
          registrations.tabs.push(options);
        }
        addCommand(options) {
          registrations.commands.push(options);
        }
        addTopBar(options) {
          registrations.topbars.push(options);
        }
      }

      class Dialog {
        constructor(options) {
          registrations.dialogs += 1;
          this.element = document.createElement("div");
          this.element.dataset.syntheticDialog = "true";
          this.element.innerHTML = `<div class="b3-dialog b3-dialog--open" style="z-index: 90">
            <div class="b3-dialog__scrim"${options.transparent ? ' style="background-color:transparent"' : ""}></div>
            <div role="dialog" aria-modal="true" tabindex="-1" class="b3-dialog__container" style="width:${options.width || "auto"};height:${options.height || "auto"}">
              <svg class="b3-dialog__close${options.hideCloseIcon ? " fn__none" : ""}"></svg>
              <div class="b3-dialog__header${options.title ? "" : " fn__none"}">${options.title || ""}</div>
              <div class="b3-dialog__body">${options.content}</div>
            </div>
          </div>`;
          document.body.appendChild(this.element);
          this.destroyCallback = options.destroyCallback;
        }
        destroy() {
          if (!this.element.isConnected) return;
          this.element.remove();
          this.destroyCallback?.();
        }
      }

      const host = {
        Plugin,
        Dialog,
        openTab: async (options) => {
          registrations.opened.push(options);
        },
        showMessage: () => {},
      };

      window.siyuan = { config: { system: { dataDir: "/synthetic-only/data" } } };
      const require = (name) => {
        if (name === "siyuan") return host;
        if (name === "node:path")
          return { resolve: (value) => value, join: (...parts) => parts.join("/") };
        if (name === "node:crypto") return { randomUUID: () => crypto.randomUUID() };
        if (name.startsWith("node:")) return {};
        throw new Error(`Unexpected external ${name}`);
      };

      const cjsModule = { exports: {} };
      new Function("require", "module", "exports", code)(require, cjsModule, cjsModule.exports);
      const plugin = new cjsModule.exports.default();
      window.hostPlugin = plugin;
      plugin.onload();
      if (!plugin.service || !plugin.notes) throw new Error("CJS host initialization failed");
      plugin.service = window.buddePreview.client;
      plugin.notes = window.buddePreview.notes;
      plugin.onLayoutReady();
      registrations.tabs[0].init.call({ element: document.querySelector("#workbench") });
    },
    {
      code: await readFile("dist/index.js", "utf8"),
      css: await readFile("dist/index.css", "utf8"),
    },
  );

  const capture = page.locator('[data-part="capture-title"]');
  await expect(capture).toBeEnabled();
  await capture.fill("构建产物页签初始化");
  await page.locator('[data-part="capture"] button[type="submit"]').click();
  await expect(capture).toHaveValue("");

  for (const theme of ["dark", "light"]) {
    await page.evaluate((t) => {
      document.documentElement.dataset.themeMode = t;
    }, theme);

    for (const order of ["before", "after"]) {
      await page.evaluate((o) => {
        const style = document.querySelector("#synthetic-siyuan-svg");
        o === "before" ? document.head.prepend(style) : document.head.append(style);
      }, order);

      const icons = await page.locator("#workbench svg").evaluateAll((nodes) =>
        nodes.map((svg) => {
          const style = getComputedStyle(svg);
          return {
            name: svg.dataset.icon || "type",
            fill: style.fill,
            stroke: style.stroke,
            color: style.color,
            strokeWidth: style.strokeWidth,
            width: style.width,
            height: style.height,
            children: [
              ...svg.querySelectorAll("path,rect,circle,polygon,polyline,line,ellipse"),
            ].map((node) => getComputedStyle(node).fill),
          };
        }),
      );

      expect(icons.length).toBeGreaterThan(0);
      for (const name of ["brand", "pool", "board", "active", "archive", "search", "settings"]) {
        expect(icons.some((icon) => icon.name === name), `missing icon coverage: ${name}`).toBe(
          true,
        );
      }

      if (order === "before") {
        await mkdir("artifacts/qa/host-icon-regression", { recursive: true });
        await page.screenshot({
          path: `artifacts/qa/host-icon-regression/outline-${theme}.png`,
          animations: "disabled",
        });
      }

      expect(
        icons.filter((icon) => icon.fill !== "none" || icon.children.some((fill) => fill !== "none")),
        `${theme}, host CSS ${order} plugin CSS: computed icon fill must remain none`,
      ).toEqual([]);

      for (const icon of icons) {
        expect(icon.stroke).toBe(icon.color);
        expect(icon.strokeWidth).toBe(icon.name === "brand" ? "1.75px" : "1.5px");
        expect(icon.width).toBe(icon.name === "brand" ? "24px" : "16px");
        expect(icon.height).toBe(icon.width);
      }

      expect(
        await page.locator("[data-host-test-icon]").evaluate((svg) => getComputedStyle(svg).fill),
        "Budde must not change host icon fill",
      ).toBe("rgb(12, 34, 56)");
    }
  }

  await page.evaluate(() => {
    delete document.documentElement.dataset.themeMode;
  });

  // Verify SettingsModal & TypePicker `input[type="search"]` box-sizing & bounds against SiYuan `input[type=search] { box-sizing: content-box }`
  await page.getByRole("button", { name: "管理类型与阶段" }).click();
  const settingsModal = page.locator('[data-budde-modal="true"]');
  await expect(settingsModal).toBeVisible();
  await settingsModal.getByRole("button", { name: "更换图标与配色" }).click();
  const iconSearch = settingsModal.getByRole("searchbox", { name: "搜索图标" });
  await expect(iconSearch).toBeVisible();
  const searchMetrics = await iconSearch.evaluate((input) => {
    const card = input.closest("[data-type-picker]").parentElement;
    const ir = input.getBoundingClientRect();
    const cr = card.getBoundingClientRect();
    return {
      boxSizing: getComputedStyle(input).boxSizing,
      height: ir.height,
      overflowRight: ir.right - cr.right,
      overflowLeft: cr.left - ir.left,
    };
  });
  expect(searchMetrics.boxSizing).toBe("border-box");
  expect(Math.abs(searchMetrics.height - 36)).toBeLessThanOrEqual(1);
  expect(searchMetrics.overflowRight).toBeLessThanOrEqual(0);
  expect(searchMetrics.overflowLeft).toBeLessThanOrEqual(0);
  await settingsModal.getByRole("button", { name: "关闭设置" }).click();
  await expect(settingsModal).toHaveCount(0);

  // Verify clicking card opens DetailPanel
  await page.locator(".card-open", { hasText: "构建产物页签初始化" }).click();
  await expect(page.locator(".detail-pane")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "事项标题" })).toHaveValue("构建产物页签初始化");

  // Verify brand SVG path parity between host topbar symbol and workbench header
  const hostMark = await page.evaluate(() => {
    const symbol = new DOMParser()
      .parseFromString(window.hostRegistrations.icons[0], "image/svg+xml")
      .querySelector("symbol");
    const icon = document.querySelector('.brand [data-icon="brand"]');
    return {
      hostPath: symbol.querySelector("path").getAttribute("d"),
      workbenchPath: icon.querySelector("path").getAttribute("d"),
      hostViewBox: symbol.getAttribute("viewBox"),
      workbenchViewBox: icon.getAttribute("viewBox"),
      topbarIcon: window.hostRegistrations.topbars[0].icon,
    };
  });
  expect(hostMark.hostPath).toBeTruthy();
  expect(hostMark.hostPath).toBe(hostMark.workbenchPath);
  expect(hostMark.hostViewBox).toBe(hostMark.workbenchViewBox);
  expect(hostMark.topbarIcon).toBe("iconBudde");

  // Verify Quick Capture Dialog via command[1] (⌥⇧N), including SVG outline inside .b3-dialog
  await page.evaluate(() => {
    window.hostRegistrations.commands[1].callback();
  });
  const qcInput = page.locator('[data-part="quick-capture-input"]');
  await expect(qcInput).toBeVisible();
  const qcFilledIcons = await page
    .locator('[data-synthetic-dialog="true"] .budde svg')
    .evaluateAll((nodes) =>
      nodes.filter(
        (svg) =>
          getComputedStyle(svg).fill !== "none" ||
          [...svg.querySelectorAll("path,rect,circle,polygon,polyline,line,ellipse")].some(
            (child) => getComputedStyle(child).fill !== "none",
          ),
      ).length,
    );
  expect(qcFilledIcons).toBe(0);
  await qcInput.fill("通过全局快捷弹窗捕获的想法");
  await qcInput.press("Enter");
  await expect(page.locator('[data-synthetic-dialog="true"]')).toHaveCount(0);
  await expect(page.locator(".card-title", { hasText: "通过全局快捷弹窗捕获的想法" })).toBeVisible();

  // Verify openBudde command & topbar callback
  await page.evaluate(() => {
    window.hostRegistrations.commands[0].callback();
    window.hostRegistrations.topbars[0].callback();
  });
  await expect.poll(() => page.evaluate(() => window.hostRegistrations.opened.length)).toBe(2);

  // Tab destroy, remount, and plugin unload
  await page.evaluate(() =>
    window.hostRegistrations.tabs[0].destroy.call({
      element: document.querySelector("#workbench"),
    }),
  );
  await expect(page.locator("#workbench")).toBeEmpty();

  await page.evaluate(() => {
    window.hostRegistrations.tabs[0].init.call({
      element: document.querySelector("#workbench"),
    });
  });
  await expect(capture).toBeEnabled();

  await page.evaluate(() => window.hostPlugin.onunload());
  await expect(page.locator("#workbench")).toBeEmpty();
  expect(errors).toEqual([]);

  console.log(
    "Built CJS SVG isolation, Quick Capture dialog, DetailPanel, tab lifecycle, and unload passed in synthetic browser host.",
  );
} finally {
  await browser.close();
  await preview.close();
}
