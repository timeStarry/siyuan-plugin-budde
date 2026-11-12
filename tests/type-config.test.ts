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

test("type presentation and reviewDays are persisted on creation, exported and reconstructed cleanly", async () => {
  const client = setup();
  const command = {
    kind: "type.create" as const,
    expectedRevision: 0,
    name: "资料",
    icon: "BookOpen",
    color: "emerald" as const,
    reviewDays: 30,
  };
  const created = await client.execute(command);
  const added = created.state.types.at(-1)!;
  assert.equal(added.icon, "BookOpen");
  assert.equal(added.color, "emerald");
  assert.equal(added.reviewDays, 30);

  const exported = JSON.parse(await client.exportData());
  assert.deepEqual(Object.keys(exported).sort(), ["data", "exportedAt", "noteContentsIncluded", "product"]);
  assert.equal(exported.product, "Budde");
  assert.equal(exported.noteContentsIncluded, false);
  assert.equal(exported.data.schemaVersion, 2);
  assert.deepEqual(await new BuddeService(new MemoryStore(exported.data), clock).snapshot(), created.state);
});

test("presentation updates preserve omitted fields and item versions, while null resets icon/color or disables reviewDays", async () => {
  const client = setup();
  const captured = await client.execute({ kind: "item.create", title: "合成事项", requestId: "metadata-item" });
  const first = {
    kind: "type.update" as const,
    id: "general",
    name: "通用",
    expectedRevision: captured.state.revision,
    icon: "👩🏽‍💻",
    color: "violet" as const,
    reviewDays: null,
  };
  let { state } = await client.execute(first);
  assert.equal(state.types[0].icon, "👩🏽‍💻");
  assert.equal(state.types[0].color, "violet");
  assert.equal(state.types[0].reviewDays, null);

  ({ state } = await client.execute({ kind: "type.update", id: "general", name: "改名", expectedRevision: state.revision }));
  assert.equal(state.types[0].icon, "👩🏽‍💻");
  assert.equal(state.types[0].color, "violet");
  assert.equal(state.types[0].reviewDays, null);
  assert.deepEqual(state.items, captured.state.items);

  const reset = { kind: "type.update" as const, id: "general", name: "改名", expectedRevision: state.revision, icon: null, color: null };
  ({ state } = await client.execute(reset));
  assert.equal(Object.hasOwn(state.types[0], "icon"), false);
  assert.equal(Object.hasOwn(state.types[0], "color"), false);
  assert.equal(state.revision, captured.state.revision + 3);
  assert.equal(state.items[0].version, 1);
});

test("single Emoji graphemes and curated icons are accepted, while invalid icons/colors/reviewDays roll back", async () => {
  const client = setup();
  for (const icon of ["🇨🇳", "1️⃣", "☕", "❤️", "👨‍👩‍👧‍👦", "Rocket", "GraduationCap"]) {
    const before = await client.snapshot();
    const command = { kind: "type.update" as const, id: "general", name: "通用", expectedRevision: before.revision, icon };
    const { state } = await client.execute(command);
    assert.equal(state.types[0].icon, icon);
  }
  for (const metadata of [
    { icon: "abc" },
    { icon: "🌱🌱" },
    { icon: "<svg/>" },
    { icon: "BookOpen " },
    { icon: "NotALucideIcon" },
    { color: "red" },
    { color: 1 },
    { reviewDays: 0 },
    { reviewDays: 999 },
  ]) {
    const before = await client.snapshot();
    await assert.rejects(
      client.execute({ kind: "type.update", id: "general", name: "不应写入", expectedRevision: before.revision, ...metadata } as Command),
      { code: "INVALID" },
    );
    assert.deepEqual(await client.snapshot(), before);
  }
});

test("present but invalid persisted metadata fails closed instead of silently normalizing", () => {
  for (const metadata of [{ icon: "two words" }, { icon: "🌱🌱" }, { icon: null }, { color: "red" }, { color: null }, { reviewDays: -5 }]) {
    const state = createInitialState();
    Object.assign(state.types[0], metadata);
    const before = JSON.stringify(state);
    assert.throws(() => validateState(state), { code: "INVALID" });
    assert.equal(JSON.stringify(state), before);
  }
});

test("type.reorder reorders types atomically and rejects incomplete or duplicate lists", async () => {
  const client = setup();
  const initial = await client.snapshot();
  const reversed = [...initial.types].reverse().map((t) => t.id);
  const { state } = await client.execute({
    kind: "type.reorder",
    ids: reversed,
    expectedRevision: 0,
  });
  assert.deepEqual(state.types.map((t) => t.id), reversed);
  await assert.rejects(
    client.execute({ kind: "type.reorder", ids: reversed.slice(1), expectedRevision: state.revision }),
    { code: "INVALID" },
  );
});

test("type templates are created atomically with fresh IDs and default presentation", async () => {
  const client = setup();
  const command = { kind: "type.create" as const, name: "文章模板", expectedRevision: 0, template: "article" as const, icon: "PenLine", color: "amber" as const };
  const { state } = await client.execute(command);
  const type = state.types.at(-1)!;
  assert.deepEqual(type.stages.map(({ name, completed }) => ({ name, completed })), [
    { name: "选题", completed: false },
    { name: "写作", completed: false },
    { name: "修改", completed: false },
    { name: "已发布", completed: true },
  ]);
  assert.equal(type.initialStageId, type.stages[0].id);
  assert.equal(type.icon, "PenLine");
  assert.equal(state.revision, 1);

  const ids = state.types.flatMap((t) => [t.id, ...t.stages.map((s) => s.id)]);
  assert.equal(new Set(ids).size, ids.length);

  const basic = await client.execute({ kind: "type.create", name: "默认", expectedRevision: 1 });
  assert.deepEqual(
    basic.state.types.at(-1)!.stages.map((s) => [s.name, s.completed]),
    [["想法", false], ["进行中", false], ["完成", true]],
  );
});

test("NodeFileStore persists updates and hasChangedSince detects mtime changes without redundant reads", async (t) => {
  const data = await fs.mkdtemp(path.join(os.tmpdir(), "budde-type-config-test-"));
  t.after(async () => {
    const target = path.resolve(data);
    assert.ok(target.startsWith(path.resolve(os.tmpdir()) + path.sep + "budde-type-config-test-"));
    await fs.rm(target, { recursive: true, force: true });
  });
  const store = new NodeFileStore(data, createInitialState, validateState);
  const check0 = await store.hasChangedSince(0);
  assert.equal(check0.mtimeMs, 0);

  const client = new BuddeService(store, clock);
  await client.execute({
    kind: "type.update",
    id: "general",
    name: "通用",
    expectedRevision: 0,
    icon: "🌱",
    color: "rose",
  });

  const check1 = await store.hasChangedSince(0);
  assert.equal(check1.changed, true);
  assert.ok(check1.mtimeMs > 0);

  const check2 = await store.hasChangedSince(check1.mtimeMs);
  assert.equal(check2.changed, false);

  const reopened = new BuddeService(new NodeFileStore(data, createInitialState, validateState), clock);
  const state = await reopened.snapshot();
  assert.equal(state.types[0].icon, "🌱");
  assert.equal(state.types[0].color, "rose");
  assert.equal(state.revision, 1);
});
