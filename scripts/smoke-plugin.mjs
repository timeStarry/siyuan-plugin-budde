import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// Emulate SiYuan 3.4.1's CJS loader without installing or touching the real workspace.
const registrations = { tabs: [], commands: [], topbars: [] };
class Plugin {
  constructor() {
    this.name = "siyuan-plugin-budde";
    this.app = {};
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
const nodeRequire = createRequire(import.meta.url);
const host = { Plugin, openTab: async () => ({}), showMessage: () => {} };
const manifest = JSON.parse(await readFile("dist/plugin.json", "utf8"));
assert.equal(manifest.name, "siyuan-plugin-budde");
assert.equal(manifest.minAppVersion, "3.4.1");
globalThis.window = {
  siyuan: {
    config: {
      system: {
        dataDir: path.join(os.tmpdir(), "budde-loader-smoke-no-writes"),
      },
    },
  },
};
globalThis.document = { visibilityState: "visible" };
const module = { exports: {} };
new Function(
  "require",
  "module",
  "exports",
  await readFile("dist/index.js", "utf8"),
)(
  (name) => (name === "siyuan" ? host : nodeRequire(name)),
  module,
  module.exports,
);
const plugin = new module.exports.default();
try {
  plugin.onload();
  plugin.onLayoutReady();
  assert.equal(registrations.tabs[0].type, "workbench");
  assert.equal(registrations.commands[0].langKey, "openBudde");
  assert.equal(registrations.topbars.length, 1);
  // The storage/notes modules must initialize under the loader, not just the UI shell.
  assert.ok(plugin.service, "Node storage initialization failed");
  assert.ok(plugin.notes, "Note bridge initialization failed");
  console.log(
    "SiYuan-compatible CJS loader, Node built-ins, tab/command/topbar registration and unload passed. No live workspace touched.",
  );
} finally {
  plugin.onunload();
  delete globalThis.window;
  delete globalThis.document;
}
