import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { BuddeService, MemoryStore, createInitialState, validateState } from "../src/core/service";
import { NodeFileStore } from "../src/platform/node-file-store";
import type { Command } from "../src/core/types";

const clock = () => "2026-11-11T00:00:00.000Z";
const setup = () => new BuddeService(new MemoryStore(), clock);

test("type presentation is persisted by creation, exported and reconstructed without changing the export envelope", async () => {
  const client = setup();
  const command = { kind: "type.create" as const, expectedRevision: 0, name: "资料", icon: "BookOpen", color: "emerald" as const };
  const created = await client.execute(command);
  assert.equal(created.state.types.at(-1)?.icon, "BookOpen");
  assert.equal(created.state.types.at(-1)?.color, "emerald");
  const exported = JSON.parse(await client.exportData());
  assert.deepEqual(Object.keys(exported).sort(), ["data", "exportedAt", "noteContentsIncluded", "product"]);
  assert.equal(exported.product, "Budde");
  assert.equal(exported.noteContentsIncluded, false);
  assert.equal(exported.data.schemaVersion, 1);
  assert.deepEqual(await new BuddeService(new MemoryStore(exported.data), clock).snapshot(), created.state);
});

test("presentation updates preserve omitted fields and item versions, while null resets stored defaults", async () => {
  const client = setup();
  const captured = await client.execute({ kind: "item.create", title: "合成事项", requestId: "metadata-item" });
  const first = { kind: "type.update" as const, id: "general", name: "通用", expectedRevision: captured.state.revision, icon: "👩🏽‍💻", color: "violet" as const };
  let { state } = await client.execute(first);
  assert.equal(state.types[0].icon, "👩🏽‍💻");
  assert.equal(state.types[0].color, "violet");
  ({ state } = await client.execute({ kind: "type.update", id: "general", name: "改名", expectedRevision: state.revision }));
  assert.equal(state.types[0].icon, "👩🏽‍💻");
  assert.equal(state.types[0].color, "violet");
  assert.deepEqual(state.items, captured.state.items);
  const reset = { kind: "type.update" as const, id: "general", name: "改名", expectedRevision: state.revision, icon: null, color: null };
  ({ state } = await client.execute(reset));
  assert.equal(Object.hasOwn(state.types[0], "icon"), false);
  assert.equal(Object.hasOwn(state.types[0], "color"), false);
  assert.equal(state.revision, captured.state.revision + 3);
  assert.equal(state.items[0].version, 1);
});

test("single Emoji graphemes including flags and keycaps are accepted, but text, multiple icons and unknown palette values roll back", async () => {
  const client = setup();
  for (const icon of ["🇨🇳", "1️⃣", "☕", "❤️", "👨‍👩‍👧‍👦"]) {
    const before = await client.snapshot();
    const command = { kind: "type.update" as const, id: "general", name: "通用", expectedRevision: before.revision, icon };
    const { state } = await client.execute(command);
    assert.equal(state.types[0].icon, icon);
  }
  for (const metadata of [{ icon: "abc" }, { icon: "🌱🌱" }, { icon: "" }, { icon: "<svg/>" }, { icon: "BookOpen " }, { icon: "NotALucideIcon" }, { color: "red" }, { color: 1 }]) {
    const before = await client.snapshot();
    await assert.rejects(client.execute({ kind: "type.update", id: "general", name: "不应写入", expectedRevision: before.revision, ...metadata } as Command), { code: "INVALID" });
    assert.deepEqual(await client.snapshot(), before);
  }
});

test("present but invalid persisted metadata fails closed instead of silently normalizing", () => {
  for (const metadata of [{ icon: "two words" }, { icon: "🌱🌱" }, { icon: null }, { color: "red" }, { color: null }]) {
    const state = createInitialState();
    Object.assign(state.types[0], metadata);
    const before = JSON.stringify(state);
    assert.throws(() => validateState(state), { code: "INVALID" });
    assert.equal(JSON.stringify(state), before);
  }
});

test("legacy snapshots retain exact shape and revision on validation, read and export", async () => {
  const legacy = createInitialState();
  const before = JSON.stringify(legacy);
  assert.equal(validateState(legacy), legacy);
  const client = new BuddeService(new MemoryStore(legacy), clock);
  assert.equal(JSON.stringify(await client.snapshot()), before);
  assert.equal(JSON.stringify(JSON.parse(await client.exportData()).data), before);
  assert.equal(JSON.stringify(legacy), before);
  for (const type of legacy.types) {
    assert.equal(Object.hasOwn(type, "icon"), false);
    assert.equal(Object.hasOwn(type, "color"), false);
  }
});

test("metadata updates reject a stale config revision without altering any state", async () => {
  const client = setup();
  const before = await client.execute({ kind: "type.update", id: "general", name: "改名", expectedRevision: 0 });
  const command = { kind: "type.update" as const, id: "general", name: "过期", expectedRevision: 0, icon: "Plane", color: "blue" as const };
  await assert.rejects(client.execute(command), { code: "CONFLICT" });
  assert.deepEqual(await client.snapshot(), before.state);
});

test("type templates are created atomically with fresh IDs and retain legacy default stages", async () => {
  const client = setup();
  const command = { kind: "type.create" as const, name: "文章模板", expectedRevision: 0, template: "article" as const, icon: "PenLine", color: "amber" as const };
  const { state } = await client.execute(command);
  const type = state.types.at(-1)!;
  assert.deepEqual(type.stages.map(({ name, completed }) => ({ name, completed })), [
    { name: "选题", completed: false }, { name: "写作", completed: false }, { name: "修改", completed: false }, { name: "已发布", completed: true },
  ]);
  assert.equal(type.initialStageId, type.stages[0].id);
  assert.equal(type.icon, "PenLine");
  assert.equal(state.revision, 1);
  const ids = state.types.flatMap(t => [t.id, ...t.stages.map(s => s.id)]);
  assert.equal(new Set(ids).size, ids.length);
  const legacy = await client.execute({ kind: "type.create", name: "默认", expectedRevision: 1 });
  assert.deepEqual(legacy.state.types.at(-1)!.stages.map(s => [s.name, s.completed]), [["想法", false], ["完成", true]]);
  const before = await client.snapshot();
  for (const template of ["unknown", null, 1, true, {}, ["software"]]) {
    await assert.rejects(client.execute({ ...command, expectedRevision: before.revision, template } as unknown as Command), { code: "INVALID" });
    assert.deepEqual(await client.snapshot(), before);
  }
});

test("presentation survives file-store recreation and legacy reads never rewrite the file", async t => {
  const data = await fs.mkdtemp(path.join(os.tmpdir(), "budde-type-config-test-"));
  t.after(async () => {
    const target = path.resolve(data);
    assert.ok(target.startsWith(path.resolve(os.tmpdir()) + path.sep + "budde-type-config-test-"));
    await fs.rm(target, { recursive: true, force: true });
  });
  const store = new NodeFileStore(data, createInitialState, validateState);
  await fs.mkdir(path.dirname(store.filePath), { recursive: true });
  const legacyBytes = JSON.stringify(createInitialState(), null, 4) + "\n";
  await fs.writeFile(store.filePath, legacyBytes);
  const client = new BuddeService(store, clock);
  await client.snapshot(); await client.exportData();
  assert.equal(await fs.readFile(store.filePath, "utf8"), legacyBytes);
  const command = { kind: "type.update" as const, id: "general", name: "通用", expectedRevision: 0, icon: "🌱", color: "rose" as const };
  await client.execute(command);
  const reopened = new BuddeService(new NodeFileStore(data, createInitialState, validateState), clock);
  const state = await reopened.snapshot();
  assert.equal(state.types[0].icon, "🌱");
  assert.equal(state.types[0].color, "rose");
  assert.equal(state.revision, 1);
});
