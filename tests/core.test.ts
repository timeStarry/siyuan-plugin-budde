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

test("title-only capture has stable identity, pool status, and no dates or note requirements", async () => {
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
  assert.equal(second.state.items[0].status, "pool");
  assert.equal(second.state.items[0].pinned, false);
  assert.ok(second.state.items[0].order < second.state.items[1].order);
  await assert.rejects(
    client.execute({
      kind: "item.create",
      title: " ",
      requestId: "request-0003",
    }),
    /标题/,
  );
});

test("legacy schemaVersion 1 snapshots upgrade seamlessly in memory to schemaVersion 2", async () => {
  const legacyV1 = {
    schemaVersion: 1,
    revision: 7,
    types: [
      {
        id: "general",
        name: "通用",
        initialStageId: "general-0",
        stages: [
          { id: "general-0", name: "想法", completed: false },
          { id: "general-1", name: "进行中", completed: false },
          { id: "general-2", name: "完成", completed: true },
        ],
      },
    ],
    items: [
      {
        id: "item-pool",
        title: "池中想法",
        typeId: "general",
        stageId: "general-0",
        promoted: false,
        paused: false,
        archived: false,
        description: "",
        nextStep: "",
        links: [],
        createdAt: "2026-10-01T00:00:00.000Z",
        updatedAt: "2026-10-01T00:00:00.000Z",
        reviewedAt: null,
        version: 1,
      },
      {
        id: "item-paused",
        title: "暂停项目",
        typeId: "general",
        stageId: "general-1",
        promoted: true,
        paused: true,
        archived: false,
        description: "细节",
        nextStep: "等待反馈",
        links: [
          {
            id: "l1",
            target: "siyuan://blocks/20260101000000-abcdefg",
            title: "设计稿",
            role: "reference",
          },
        ],
        createdAt: "2026-10-02T00:00:00.000Z",
        updatedAt: "2026-10-03T00:00:00.000Z",
        reviewedAt: "2026-10-03T00:00:00.000Z",
        version: 3,
      },
      {
        id: "item-archived",
        title: "归档项目",
        typeId: "general",
        stageId: "general-2",
        promoted: true,
        paused: false,
        archived: true,
        description: "",
        nextStep: "",
        links: [],
        createdAt: "2026-10-04T00:00:00.000Z",
        updatedAt: "2026-10-05T00:00:00.000Z",
        reviewedAt: "2026-10-05T00:00:00.000Z",
        version: 2,
      },
    ],
    requests: {
      "legacy-req-01": {
        fingerprint: '["池中想法",null]',
        itemId: "item-pool",
      },
    },
  };

  const upgraded = validateState(legacyV1);
  assert.equal(upgraded.schemaVersion, 2);
  assert.equal(upgraded.revision, 7);
  assert.equal(upgraded.items[0].status, "pool");
  assert.equal(upgraded.items[1].status, "paused");
  assert.equal(upgraded.items[1].links[0].title, "设计稿");
  assert.equal(upgraded.items[2].status, "archived");
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
      patch: { title: "并发修改" },
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

test("moving a pool item past initialStageId auto-promotes to active; cross-type switch defaults to target initialStageId", async () => {
  const client = setup();
  let r = await client.execute({
    kind: "item.create",
    title: "自动推进的想法",
    requestId: "request-auto-promote",
  });
  const id = r.itemId!;
  assert.equal(r.state.items[0].status, "pool");
  assert.equal(r.state.items[0].reviewedAt, null);

  r = await client.execute({
    kind: "item.update",
    id,
    expectedVersion: 1,
    patch: { stageId: "general-1", description: "长期资料", nextStep: "先验证" },
  });
  assert.equal(r.state.items[0].status, "active");
  assert.equal(r.state.items[0].reviewedAt, "2026-11-11T00:00:00.000Z");

  // Switching type without stageId cleanly falls back to targetType.initialStageId
  r = await client.execute({
    kind: "item.update",
    id,
    expectedVersion: 2,
    patch: { typeId: "article" },
  });
  assert.equal(r.state.items[0].typeId, "article");
  assert.equal(r.state.items[0].stageId, "article-0");
  assert.equal(r.state.items[0].description, "长期资料");
});

test("item.delete, item.reorder, items.archiveCompleted and items.purgeArchived maintain strict consistency", async () => {
  const client = setup();
  const a = await client.execute({
    kind: "item.create",
    title: "事项 A",
    status: "active",
    stageId: "general-3",
    requestId: "req-item-a",
  });
  const b = await client.execute({
    kind: "item.create",
    title: "事项 B",
    status: "active",
    stageId: "general-1",
    requestId: "req-item-b",
  });
  const c = await client.execute({
    kind: "item.create",
    title: "事项 C",
    status: "active",
    stageId: "general-1",
    requestId: "req-item-c",
  });

  // Reorder B after C inside general-1
  const reordered = await client.execute({
    kind: "item.reorder",
    id: b.itemId!,
    stageId: "general-1",
    afterId: c.itemId!,
  });
  const itemB = reordered.state.items.find((i) => i.id === b.itemId)!;
  const itemC = reordered.state.items.find((i) => i.id === c.itemId)!;
  assert.ok(itemB.order > itemC.order);

  // Batch archive completed (item A is in general-3 which is completed)
  const archivedRes = await client.execute({
    kind: "items.archiveCompleted",
    expectedRevision: reordered.state.revision,
  });
  assert.equal(archivedRes.affectedCount, 1);
  assert.equal(
    archivedRes.state.items.find((i) => i.id === a.itemId)?.status,
    "archived",
  );

  // Purge archived removes item A and cleans its request record
  const purged = await client.execute({
    kind: "items.purgeArchived",
    expectedRevision: archivedRes.state.revision,
  });
  assert.equal(purged.affectedCount, 1);
  assert.equal(purged.state.items.some((i) => i.id === a.itemId), false);
  assert.equal(Object.hasOwn(purged.state.requests, "req-item-a"), false);

  // Single item delete removes item B
  const deleted = await client.execute({
    kind: "item.delete",
    id: b.itemId!,
  });
  assert.equal(deleted.state.items.length, 1);
  assert.equal(deleted.state.items[0].id, c.itemId);
});

test("stage deletion and type deletion with targetTypeId migrate items (including archived) atomically", async () => {
  const client = setup();
  const r1 = await client.execute({
    kind: "item.create",
    title: "归档事项",
    typeId: "general",
    stageId: "general-0",
    requestId: "req-migrate-1",
  });
  const r2 = await client.execute({
    kind: "item.create",
    title: "已完成事项",
    typeId: "general",
    status: "active",
    stageId: "general-3",
    requestId: "req-migrate-2",
  });
  await client.execute({
    kind: "item.update",
    id: r1.itemId!,
    expectedVersion: 1,
    patch: { status: "archived" },
  });

  const snap1 = await client.snapshot();
  await assert.rejects(
    client.execute({
      kind: "stage.delete",
      typeId: "general",
      id: "general-0",
      expectedRevision: snap1.revision,
    }),
    /迁移/,
  );

  const stageMoved = await client.execute({
    kind: "stage.delete",
    typeId: "general",
    id: "general-0",
    targetId: "general-1",
    expectedRevision: snap1.revision,
  });
  assert.equal(
    stageMoved.state.items.find((i) => i.id === r1.itemId)?.stageId,
    "general-1",
  );
  assert.equal(stageMoved.state.types[0].initialStageId, "general-1");

  // Type delete without targetTypeId fails when items exist
  await assert.rejects(
    client.execute({
      kind: "type.delete",
      id: "general",
      expectedRevision: stageMoved.state.revision,
    }),
    { code: "IN_USE" },
  );

  // Type delete WITH targetTypeId migrates active, completed, and archived items cleanly
  const typeDeleted = await client.execute({
    kind: "type.delete",
    id: "general",
    targetTypeId: "article",
    expectedRevision: stageMoved.state.revision,
  });
  assert.equal(typeDeleted.affectedCount, 2);
  assert.equal(typeDeleted.state.types.some((t) => t.id === "general"), false);
  const migratedArchived = typeDeleted.state.items.find((i) => i.id === r1.itemId)!;
  const migratedCompleted = typeDeleted.state.items.find((i) => i.id === r2.itemId)!;
  assert.equal(migratedArchived.typeId, "article");
  assert.equal(migratedArchived.stageId, "article-0");
  assert.equal(migratedArchived.status, "archived");
  assert.equal(migratedCompleted.typeId, "article");
  assert.equal(migratedCompleted.stageId, "article-3");
});

test("invalid links, unknown schema versions, duplicate stage IDs and malformed commands are rejected", async () => {
  const s = createInitialState();
  assert.throws(() => validateState({ ...s, schemaVersion: 99 }), /版本/);
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

test("export and importData preserve configuration, items, versions, and clean stale optional keys", async () => {
  const client = setup();
  await client.execute({
    kind: "type.create",
    name: "课程",
    expectedRevision: 0,
  });
  await client.execute({
    kind: "item.create",
    title: "测试导出与导入",
    requestId: "request-0001",
  });
  const exportedRaw = await client.exportData();
  const exported = JSON.parse(exportedRaw);
  assert.deepEqual(validateState(exported.data), await client.snapshot());
  assert.equal(exported.noteContentsIncluded, false);

  const target = setup();
  await target.execute({
    kind: "preference.setNotebook",
    notebookId: "old-notebook",
  });
  const importedState = await target.importData(exportedRaw);
  assert.equal(importedState.items.length, 1);
  assert.equal(importedState.items[0].title, "测试导出与导入");
  assert.equal(importedState.defaultNotebookId, undefined);
});
