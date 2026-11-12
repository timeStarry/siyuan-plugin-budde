import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL("../", import.meta.url));

// Emulate SiYuan 3.4.1+ CJS loader without touching any real user workspace.
const registrations = { tabs: [], commands: [], topbars: [], events: new Map(), messages: [] };
class Plugin {
  constructor() {
    this.name = "siyuan-plugin-budde";
    this.app = {};
    this.i18n = {
      openBudde: "打开 Budde 想法池与看板",
      quickCaptureBudde: "快速记录想法到 Budde",
      captureBlockToBudde: "收入 Budde 想法池",
      captureDocToBudde: "将本文档收入 Budde 想法池",
    };
    this.eventBus = {
      on(type, handler) {
        registrations.events.set(type, handler);
      },
      off(type, handler) {
        if (registrations.events.get(type) === handler) {
          registrations.events.delete(type);
        }
      },
    };
  }
  addIcons(svg) {
    assert.match(svg, /iconBudde/);
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

const tempWorkspace = await mkdtemp(path.join(os.tmpdir(), "budde-loader-smoke-"));
const nodeRequire = createRequire(import.meta.url);
const host = {
  Plugin,
  Dialog: undefined,
  openTab: async () => ({}),
  showMessage: (msg) => {
    registrations.messages.push(msg);
  },
};

const pkg = JSON.parse(await readFile(path.join(rootDir, "package.json"), "utf8"));
const manifest = JSON.parse(await readFile(path.join(rootDir, "dist/plugin.json"), "utf8"));
assert.equal(manifest.name, "siyuan-plugin-budde");
assert.equal(manifest.version, pkg.version);
assert.equal(manifest.minAppVersion, "3.4.1");

globalThis.window = {
  siyuan: {
    config: {
      system: {
        dataDir: path.join(tempWorkspace, "data"),
      },
    },
  },
};
globalThis.document = { visibilityState: "visible" };

const cjsModule = { exports: {} };
new Function(
  "require",
  "module",
  "exports",
  await readFile(path.join(rootDir, "dist/index.js"), "utf8"),
)(
  (name) => (name === "siyuan" ? host : nodeRequire(name)),
  cjsModule,
  cjsModule.exports,
);

const plugin = new cjsModule.exports.default();
try {
  plugin.onload();
  plugin.onLayoutReady();

  assert.equal(registrations.tabs[0].type, "workbench");
  assert.deepEqual(
    registrations.commands.map((c) => c.langKey),
    ["openBudde", "quickCaptureBudde"],
  );
  assert.equal(registrations.topbars.length, 1);
  assert.equal(registrations.events.has("click-blockicon"), true);
  assert.equal(registrations.events.has("click-editortitleicon"), true);
  assert.ok(plugin.service, "Node storage initialization failed");
  assert.ok(plugin.notes, "Note bridge initialization failed");

  // Exercise editor block menu capture into isolated temp store
  const menuItems = [];
  registrations.events.get("click-blockicon")({
    detail: {
      menu: { addItem: (item) => menuItems.push(item) },
      blockElements: [
        {
          getAttribute: (attr) => (attr === "data-node-id" ? "20260101120000-blktest" : null),
          textContent: "阅读笔记中涌现的新想法",
        },
      ],
    },
  });
  assert.equal(menuItems.length, 1);
  menuItems[0].click();

  // Wait briefly for async captureFromEditor transaction
  await new Promise((r) => setTimeout(r, 80));
  const state = await plugin.service.snapshot();
  assert.equal(state.items.length, 8);
  assert.equal(state.items[0].title, "阅读笔记中涌现的新想法");
  assert.equal(state.items[0].links[0].target, "siyuan://blocks/20260101120000-blktest");

  console.log(
    "SiYuan CJS loader, Node storage, commands (openBudde + quickCaptureBudde), editor block capture and clean unload passed.",
  );
} finally {
  plugin.onunload();
  assert.equal(registrations.events.size, 0, "eventBus listeners must be cleaned up on unload");
  delete globalThis.window;
  delete globalThis.document;
  await rm(tempWorkspace, { recursive: true, force: true });
}
