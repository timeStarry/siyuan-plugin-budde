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
    // Emulate SiYuan desktop global CSS PLUS high-specificity container/dialog/path theme selectors
    // that previously defeated zero-specificity `.budde :where(svg) { fill: none }`.
    document.body.classList.add("layout-tab-container");
    const style = document.createElement("style");
    style.id = "synthetic-siyuan-svg";
    style.textContent = [
      "svg { fill: currentColor; display: inline-block; }",
      ".layout-tab-container svg, .b3-dialog svg, html[data-theme-mode] svg { fill: currentColor; }",
      ".layout-tab-container svg path, .layout-tab-container svg circle, .layout-tab-container svg rect { fill: currentColor; }",
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
          this.element.className = "b3-dialog";
          this.element.dataset.syntheticDialog = "true";
          this.element.innerHTML = options.content;
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
    .locator('[data-synthetic-dialog="true"] svg')
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
