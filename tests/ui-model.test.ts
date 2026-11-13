import test from "node:test";
import assert from "node:assert/strict";
import { BuddeService, MemoryStore } from "../src/core/service";
import {
  CaptureRequest,
  getWorkspaceCounts,
  needsReview,
  selectActiveItems,
  selectArchiveItems,
  selectBoardItems,
  selectPoolItems,
  type ViewFilters,
} from "../src/ui/model";

const defaultFilters: ViewFilters = {
  query: "",
  typeId: "",
  includeActiveInPool: false,
  activeFocus: "all",
  hidePausedOnBoard: false,
  sort: "manual",
};

async function fixture() {
  const client = new BuddeService(new MemoryStore());
  const result = await client.execute({
    kind: "item.create",
    requestId: crypto.randomUUID(),
    title: "一个想法",
  });
  return { client, item: result.state.items[0], state: result.state };
}

test("capture retries preserve request identity until success or edited content", () => {
  const capture = new CaptureRequest();
  const first = capture.prepare({ title: "想法", typeId: "general" });
  assert.equal(
    capture.prepare({ title: "想法", typeId: "general" }).requestId,
    first.requestId,
  );
  assert.notEqual(
    capture.prepare({ title: "想法", typeId: "article" }).requestId,
    first.requestId,
  );
  assert.notEqual(
    capture.prepare({ title: "想法", typeId: "general", status: "active" }).requestId,
    first.requestId,
  );
  capture.success();
  assert.notEqual(
    capture.prepare({ title: "想法", typeId: "general" }).requestId,
    first.requestId,
  );
});

test("view selectors distinguish pool, active focuses, board, completion and archive regardless of stage order", async () => {
  const { state, item } = await fixture();
  assert.equal(selectPoolItems(state, defaultFilters).length, 1);
  assert.equal(selectBoardItems(state, "general", defaultFilters).length, 0);

  item.status = "active";
  assert.equal(selectPoolItems(state, defaultFilters).length, 0);
  assert.equal(
    selectPoolItems(state, { ...defaultFilters, includeActiveInPool: true }).length,
    1,
  );
  assert.equal(selectActiveItems(state, defaultFilters).length, 1);

  item.status = "paused";
  assert.equal(selectActiveItems(state, defaultFilters).length, 0);
  assert.equal(
    selectActiveItems(state, { ...defaultFilters, activeFocus: "paused" }).length,
    1,
  );
  assert.equal(selectBoardItems(state, "general", defaultFilters).length, 1);
  assert.equal(
    selectBoardItems(state, "general", { ...defaultFilters, hidePausedOnBoard: true }).length,
    0,
  );

  item.stageId = state.types[0].stages.find((s) => s.completed)!.id;
  item.status = "active";
  state.types[0].stages.reverse();
  assert.equal(selectActiveItems(state, defaultFilters).length, 0);
  assert.equal(
    selectActiveItems(state, { ...defaultFilters, activeFocus: "completed" }).length,
    1,
  );

  item.status = "archived";
  assert.equal(selectPoolItems(state, defaultFilters).length, 0);
  assert.equal(selectArchiveItems(state, defaultFilters).length, 1);
});

test("review boundary respects per-type reviewDays and supplied current time without mutating state", async () => {
  const { state, item } = await fixture();
  item.status = "active";
  item.reviewedAt = "2026-10-28T00:00:00.000Z";

  // Default general reviewDays is 14
  assert.equal(needsReview(state, item, "2026-11-10T23:59:59.999Z"), false);
  assert.equal(needsReview(state, item, "2026-11-11T00:00:00.000Z"), true);

  // Custom reviewDays = 7
  state.types[0].reviewDays = 7;
  assert.equal(needsReview(state, item, "2026-11-04T00:00:00.000Z"), true);

  // Disabled review reminder (null)
  state.types[0].reviewDays = null;
  assert.equal(needsReview(state, item, "2026-12-31T00:00:00.000Z"), false);

  const counts = getWorkspaceCounts(state, "2026-12-31T00:00:00.000Z");
  assert.equal(counts.active, 1);
  assert.equal(counts.review, 0);
  assert.equal(item.reviewedAt, "2026-10-28T00:00:00.000Z");
});

test("pool sorting supports type order, title locale order, and sortAsc direction while keeping pinned items first", async () => {
  const client = new BuddeService(new MemoryStore());
  await client.execute({
    kind: "item.create",
    requestId: "r-project",
    title: "B 项目重构",
    typeId: "project",
  });
  await client.execute({
    kind: "item.create",
    requestId: "r-article",
    title: "C 技术文章",
    typeId: "article",
  });
  const third = await client.execute({
    kind: "item.create",
    requestId: "r-general",
    title: "A 日常采购",
    typeId: "general",
  });

  // Type order in default state: general (0), article (1), project (2), research (3)
  const byTypeAsc = selectPoolItems(third.state, {
    ...defaultFilters,
    sort: "type",
  });
  assert.deepEqual(
    byTypeAsc.map((i) => i.typeId),
    ["general", "article", "project"],
  );

  const byTypeDesc = selectPoolItems(third.state, {
    ...defaultFilters,
    sort: "type",
    sortAsc: false,
  });
  assert.deepEqual(
    byTypeDesc.map((i) => i.typeId),
    ["project", "article", "general"],
  );

  const byTitleAsc = selectPoolItems(third.state, {
    ...defaultFilters,
    sort: "title",
  });
  assert.deepEqual(
    byTitleAsc.map((i) => i.title),
    ["A 日常采购", "B 项目重构", "C 技术文章"],
  );

  // Pinning overrides sort order
  const projectItem = third.state.items.find((i) => i.typeId === "project")!;
  const pinnedState = (
    await client.execute({
      kind: "item.update",
      id: projectItem.id,
      expectedVersion: projectItem.version,
      patch: { pinned: true },
    })
  ).state;

  const byTitleDescWithPin = selectPoolItems(pinnedState, {
    ...defaultFilters,
    sort: "title",
    sortAsc: false,
  });
  assert.deepEqual(
    byTitleDescWithPin.map((i) => i.title),
    ["B 项目重构", "C 技术文章", "A 日常采购"],
  );
});
