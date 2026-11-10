import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BuddeService,
  MemoryStore,
  createInitialState,
  validateState,
} from "../src/core/service";
const setup = () =>
  new BuddeService(new MemoryStore(), () => "2026-11-11T00:00:00.000Z");

test("title-only capture has stable identity, no dates or note requirements; identical titles allowed", async () => {
  const client = setup();
  const first = await client.execute({
    kind: "item.create",
    title: "  一个想法  ",
    requestId: "request-0001",
  });
  const second = await client.execute({
    kind: "item.create",
    title: "一个想法",
    requestId: "request-0002",
  });
  assert.notEqual(first.itemId, second.itemId);
  assert.equal(second.state.items.length, 2);
  assert.deepEqual(second.state.items[0].links, []);
  assert.equal(second.state.items[0].promoted, false);
  await assert.rejects(
    client.execute({
      kind: "item.create",
      title: " ",
      requestId: "request-0003",
    }),
    /标题/,
  );
});

test("retry is idempotent across service recreation, with explicit conflict on reused request ID", async () => {
  const store = new MemoryStore();
  const a = new BuddeService(store);
  const b = new BuddeService(store);
  const cmd = {
    kind: "item.create" as const,
    title: "标题",
    requestId: "repeat-0001",
  };
  const [x, y] = await Promise.all([a.execute(cmd), b.execute(cmd)]);
  assert.equal(x.itemId, y.itemId);
  assert.equal(y.state.items.length, 1);
  await assert.rejects(b.execute({ ...cmd, title: "另一条" }), {
    code: "REQUEST_CONFLICT",
  });
  assert.equal((await a.snapshot()).revision, 1);
});

test("concurrent writers reject stale changes and failed changes never alter persisted state", async () => {
  const client = setup();
  const result = await client.execute({
    kind: "item.create",
    title: "原始",
    requestId: "request-0001",
  });
  const id = result.itemId!;
  const calls = await Promise.allSettled([
    client.execute({
      kind: "item.update",
      id,
      expectedVersion: 1,
      patch: { title: "人工修改" },
    }),
    client.execute({
      kind: "item.update",
      id,
      expectedVersion: 1,
      patch: { title: "AI 修改" },
    }),
  ]);
  assert.equal(calls.filter((x) => x.status === "fulfilled").length, 1);
  const before = await client.snapshot();
  await assert.rejects(
    client.execute({
      kind: "item.update",
      id,
      expectedVersion: 2,
      patch: { stageId: "travel-1" },
    }),
    /阶段/,
  );
  assert.deepEqual(await client.snapshot(), before);
});

test("successful creation retry survives deletion of its original type and changes to defaults", async () => {
  for (const typeId of [undefined, "general"]) {
    const client = setup();
    const command = {
      kind: "item.create" as const,
      title: "已迁移的想法",
      requestId: "retry-after-move",
      ...(typeId ? { typeId } : {}),
    };
    const created = await client.execute(command);
    await client.execute({
      kind: "item.update",
      id: created.itemId!,
      expectedVersion: 1,
      patch: { typeId: "article", stageId: "article-0" },
    });
    await client.execute({
      kind: "type.delete",
      id: "general",
      expectedRevision: 2,
    });
    const retried = await client.execute(command);
    assert.equal(retried.itemId, created.itemId);
    assert.equal(retried.state.items.length, 1);
    assert.equal(retried.state.items[0].typeId, "article");
  }
});

test("promote, pause, archive and cross-type move preserve content; progress alone updates review time", async () => {
  const client = setup();
  let r = await client.execute({
    kind: "item.create",
    title: "软件",
    requestId: "request-0001",
  });
  const id = r.itemId!;
  r = await client.execute({
    kind: "item.update",
    id,
    expectedVersion: 1,
    patch: { promoted: true, description: "长期资料", nextStep: "先验证" },
  });
  const progressTime = r.state.items[0].reviewedAt;
  r = await client.execute({
    kind: "item.update",
    id,
    expectedVersion: 2,
    patch: {
      paused: true,
      archived: true,
      typeId: "software",
      stageId: "software-2",
    },
  });
  assert.equal(r.state.items[0].description, "长期资料");
  assert.equal(r.state.items[0].nextStep, "先验证");
  assert.equal(r.state.items[0].reviewedAt, progressTime);
  await assert.rejects(
    client.execute({
      kind: "item.update",
      id,
      expectedVersion: 3,
      patch: { typeId: "article" },
    }),
    /目标阶段/,
  );
});

test("stage rename/reorder preserves completion meaning and IDs, with optimistic config conflicts", async () => {
  const client = setup();
  const state = await client.snapshot();
  const original = state.types[0];
  let r = await client.execute({
    kind: "stage.reorder",
    typeId: original.id,
    ids: [...original.stages].reverse().map((s) => s.id),
    expectedRevision: 0,
  });
  assert.equal(r.state.types[0].stages[0].completed, true);
  r = await client.execute({
    kind: "stage.update",
    typeId: original.id,
    id: "general-3",
    name: "收获",
    completed: true,
    expectedRevision: 1,
  });
  assert.equal(r.state.types[0].stages[0].id, "general-3");
  await assert.rejects(
    client.execute({
      kind: "stage.add",
      typeId: original.id,
      name: "新列",
      expectedRevision: 1,
    }),
    { code: "CONFLICT" },
  );
});

test("stage deletion migrates archived items atomically and bumps their versions", async () => {
  const client = setup();
  const r = await client.execute({
    kind: "item.create",
    title: "归档也不能丢",
    requestId: "request-0001",
  });
  await client.execute({
    kind: "item.update",
    id: r.itemId!,
    expectedVersion: 1,
    patch: { archived: true },
  });
  await assert.rejects(
    client.execute({
      kind: "stage.delete",
      typeId: "general",
      id: "general-0",
      expectedRevision: 2,
    }),
    /迁移/,
  );
  const moved = await client.execute({
    kind: "stage.delete",
    typeId: "general",
    id: "general-0",
    targetId: "general-1",
    expectedRevision: 2,
  });
  assert.equal(moved.state.items[0].stageId, "general-1");
  assert.equal(moved.state.items[0].archived, true);
  assert.equal(moved.state.items[0].version, 3);
  assert.equal(moved.state.types[0].initialStageId, "general-1");
  await assert.rejects(
    client.execute({ kind: "type.delete", id: "general", expectedRevision: 3 }),
    { code: "IN_USE" },
  );
});

test("invalid links, state versions, duplicate stage IDs and malformed commands are rejected", async () => {
  const s = createInitialState();
  assert.throws(() => validateState({ ...s, schemaVersion: 2 }), /版本/);
  s.types[1].stages[1].id = s.types[0].stages[0].id;
  assert.throws(() => validateState(s), /重复/);
  const client = setup();
  const r = await client.execute({
    kind: "item.create",
    title: "标题",
    requestId: "request-0001",
  });
  await assert.rejects(
    client.execute({
      kind: "item.update",
      id: r.itemId!,
      expectedVersion: 1,
      patch: {
        links: [
          {
            id: "link-1",
            title: "外部脚本",
            target: "javascript:alert(1)",
            role: "reference",
          },
        ],
      },
    }),
    /思源/,
  );
  await assert.rejects(
    client.execute({
      kind: "item.create",
      title: "标题",
      requestId: "__proto__",
    }),
    /标识/,
  );
});

test("export contains all items, custom configuration, versions and request records for reconstruction", async () => {
  const client = setup();
  await client.execute({
    kind: "type.create",
    name: "课程",
    expectedRevision: 0,
  });
  await client.execute({
    kind: "item.create",
    title: "测试导出",
    requestId: "request-0001",
  });
  const exported = JSON.parse(await client.exportData());
  assert.deepEqual(validateState(exported.data), await client.snapshot());
  assert.equal(exported.noteContentsIncluded, false);
  const restored = new BuddeService(new MemoryStore(exported.data));
  const retry = await restored.execute({
    kind: "item.create",
    title: "测试导出",
    requestId: "request-0001",
  });
  assert.equal(retry.state.items.length, 1);
});
