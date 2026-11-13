import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { BuddeService, MemoryStore, createInitialState, validateState } from "../src/core/service";
import { createTypePack, normalizeHeadingForStageMatch, parseTypePack, renderDocTemplate } from "../src/core/template";
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
    { name: "大纲素材", completed: false },
    { name: "初稿", completed: false },
    { name: "润色定稿", completed: false },
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

test("docTemplate rendering, stage criteria ID preservation, criteriaState cleanup, and TypePack import/export", async () => {
  const client = setup();
  const s0 = await client.snapshot();
  const projectType = s0.types.find((t) => t.id === "project")!;
  assert.ok(projectType.docTemplate?.includes("{{title}}"));
  assert.ok((projectType.stages[0].criteria?.length ?? 0) >= 1);

  // Preserve existing criterion IDs on stage.update and add a new one
  const stage0 = projectType.stages[0];
  const preservedCriterion = stage0.criteria![0];
  const updatedStageRes = await client.execute({
    kind: "stage.update",
    expectedRevision: s0.revision,
    typeId: "project",
    id: stage0.id,
    name: stage0.name,
    completed: stage0.completed,
    criteria: [
      { id: preservedCriterion.id, text: `${preservedCriterion.text}（补充）` },
      { text: "新增检查项" },
    ],
  });
  const updatedStage0 = updatedStageRes.state.types.find((t) => t.id === "project")!.stages[0];
  assert.equal(updatedStage0.criteria![0].id, preservedCriterion.id);
  assert.equal(updatedStage0.criteria!.length, 2);

  // Update docTemplate via type.update and render placeholders
  const tplRes = await client.execute({
    kind: "type.update",
    expectedRevision: updatedStageRes.state.revision,
    id: "project",
    name: "项目开发",
    docTemplate: "# {{title}}\n\n类型：{{type}} / 阶段：{{stage}}\n\n{{description}}\n{{nextStep}}",
  });
  const created = await client.execute({
    kind: "item.create",
    requestId: "req-tpl-1",
    title: "测试项目文档",
    description: "核心说明",
    nextStep: "先验证",
    typeId: "project",
    priority: "high",
    status: "active",
  });
  const createdItem = created.state.items.find((i) => i.id === created.itemId)!;
  assert.equal(createdItem.priority, "high");
  const updatedProj = created.state.types.find((t) => t.id === "project")!;
  const rendered = renderDocTemplate(updatedProj.docTemplate!, {
    item: createdItem,
    type: updatedProj,
    stage: updatedProj.stages[1],
    date: "2026-11-13",
  });
  assert.match(rendered, /# 测试项目文档/);
  assert.match(rendered, /核心说明/);
  assert.match(rendered, /先验证/);
  assert.equal(normalizeHeadingForStageMatch("  设 想 "), normalizeHeadingForStageMatch("设想"));
  assert.equal(normalizeHeadingForStageMatch("Phase One"), normalizeHeadingForStageMatch("phaseone"));

  // Check criteria progress & stage-bound link, then verify cleanup when migrating typeId
  const withCriteria = await client.execute({
    kind: "item.update",
    id: createdItem.id,
    expectedVersion: createdItem.version,
    patch: {
      criteriaState: {
        [updatedProj.stages[1].id]: {
          checkedIds: [updatedProj.stages[1].criteria![0].id],
          custom: [{ id: "custom-1", text: "自定义检查", done: false }],
        },
      },
      links: [
        {
          id: "link-stage-1",
          target: "siyuan://blocks/20261111120000-stage01",
          title: "调研文档",
          role: "outcome",
          stageId: updatedProj.stages[1].id,
        },
      ],
    },
  });
  const switchedType = await client.execute({
    kind: "item.update",
    id: createdItem.id,
    expectedVersion: withCriteria.state.items.find((i) => i.id === createdItem.id)!.version,
    patch: { typeId: "general" },
  });
  const migratedItem = switchedType.state.items.find((i) => i.id === createdItem.id)!;
  assert.equal(migratedItem.criteriaState, undefined);
  assert.equal(migratedItem.links[0].stageId, undefined);

  // TypePack export / parse / import generates new type & stage IDs
  const pack = createTypePack(tplRes.state.types.find((t) => t.id === "project")!, clock());
  const parsed = parseTypePack(JSON.stringify(pack));
  const imported = await client.execute({
    kind: "type.import",
    expectedRevision: switchedType.state.revision,
    pack: parsed,
  });
  const newType = imported.state.types[imported.state.types.length - 1];
  assert.notEqual(newType.id, "project");
  assert.notEqual(newType.stages[0].id, projectType.stages[0].id);
  assert.equal(newType.docTemplate, tplRes.state.types.find((t) => t.id === "project")!.docTemplate);
  assert.throws(() => parseTypePack("{bad json"), /有效的 JSON/);
});
