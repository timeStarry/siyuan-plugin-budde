import test from "node:test";
import assert from "node:assert/strict";
import { validateState } from "../../src/core/service";
import { createDemoState, DEMO_NOW } from "./fixture";
import { CaptureRequest, createDemoSession, needsReview, selectItems, type Filters } from "./model";

const all: Filters = { query: "", typeId: "", unpromotedOnly: false };

test("one valid synthetic state produces the four distinct collections", () => {
  const seed = validateState(createDemoState());
  assert.equal(seed.items.length, 15);
  assert.equal(selectItems(seed, "pool", all).length, 14);
  assert.equal(selectItems(seed, "board", all).length, 12);
  assert.equal(selectItems(seed, "active", all).length, 6);
  assert.equal(selectItems(seed, "archive", all).length, 1);
  const active = selectItems(seed, "active", all);
  const initial = active.find((item) => item.title === "做一个简洁的阅读计时器");
  assert.ok(initial);
  assert.equal(initial.stageId, "software-0");
  assert.equal(initial.nextStep, "");
  assert.ok(active.every((item) => item.promoted && !item.paused && !item.archived));
});

test("title query, type and unpromoted filters do not redefine view eligibility", () => {
  const seed = createDemoState();
  assert.equal(selectItems(seed, "pool", { ...all, unpromotedOnly: true }).length, 2);
  assert.equal(selectItems(seed, "board", { ...all, typeId: "software" }).length, 5);
  assert.equal(selectItems(seed, "active", { ...all, typeId: "software" }).length, 3);
  assert.equal(selectItems(seed, "pool", { ...all, query: "  照片  " }).length, 1);
  assert.equal(selectItems(seed, "pool", { ...all, query: "没有这个标题" }).length, 0);
  const reordered = structuredClone(seed);
  reordered.types.find((type) => type.id === "software")!.stages.reverse();
  assert.equal(selectItems(reordered, "active", { ...all, typeId: "software" }).length, 3);
});

test("review uses the exact 14-day boundary and never treats browsing as progress", () => {
  const seed = createDemoState();
  const item = seed.items.find((value) => value.title === "给照片做一个本地整理工具")!;
  item.reviewedAt = "2026-10-28T00:00:00.000Z";
  assert.equal(needsReview(seed, item, "2026-11-10T23:59:59.999Z"), false);
  assert.equal(needsReview(seed, item, DEMO_NOW), true);
  assert.equal(needsReview(seed, { ...item, paused: true }, DEMO_NOW), true);
  assert.equal(needsReview(seed, { ...item, promoted: false }, DEMO_NOW), false);
  assert.equal(needsReview(seed, { ...item, archived: true }, DEMO_NOW), false);
  assert.equal(needsReview(seed, { ...item, stageId: "software-3" }, DEMO_NOW), false);
  assert.equal(needsReview(seed, { ...item, reviewedAt: null }, DEMO_NOW), false);
  selectItems(seed, "active", all);
  assert.equal(item.reviewedAt, "2026-10-28T00:00:00.000Z");
});

test("capture keeps retry identity until success, but not after edited content", () => {
  const capture = new CaptureRequest();
  const first = capture.prepare("一个想法", "general");
  assert.equal(capture.prepare("一个想法", "general").requestId, first.requestId);
  assert.notEqual(capture.prepare("另一个想法", "general").requestId, first.requestId);
  const next = capture.prepare("另一个想法", "article");
  assert.equal(capture.prepare("另一个想法", "article").requestId, next.requestId);
  capture.success();
  assert.notEqual(capture.prepare("另一个想法", "article").requestId, next.requestId);
});

test("failed mutation preserves state and lost-response capture retries only once", async () => {
  const session = createDemoSession();
  const capture = new CaptureRequest();
  const command = capture.prepare("失败后仍保留的标题", "general");
  session.armFault("reject-next");
  await assert.rejects(session.client.execute(command), /模拟/);
  assert.equal((await session.client.snapshot()).items.length, 15);
  session.armFault("lose-response");
  await assert.rejects(session.client.execute(command), /响应/);
  assert.equal((await session.client.snapshot()).items.length, 16);
  const retry = await session.client.execute(capture.prepare("失败后仍保留的标题", "general"));
  assert.equal(retry.state.items.length, 16);
  assert.equal(retry.state.items.filter((item) => item.title === "失败后仍保留的标题").length, 1);
  assert.equal(retry.state.items.find((item) => item.id === retry.itemId)!.promoted, false);
  const beforeResetClient = session.client;
  assert.equal((await session.reset()).items.length, 15);
  assert.equal(session.client, beforeResetClient);
});

test("default creation follows core fallback when general was removed", async () => {
  const session = createDemoSession();
  let state = await session.client.snapshot();
  for (const item of state.items.filter((item) => item.typeId === "general")) {
    state = (await session.client.execute({ kind: "item.update", id: item.id,
      expectedVersion: item.version, patch: { typeId: "article", stageId: "article-0" } })).state;
  }
  state = (await session.client.execute({ kind: "type.delete", id: "general", expectedRevision: state.revision })).state;
  const result = await session.client.execute(new CaptureRequest().prepare("没有通用的默认记录"));
  const item = result.state.items.find((value) => value.id === result.itemId)!;
  assert.equal(item.typeId, "article");
  assert.equal(item.stageId, "article-0");
  assert.equal(item.promoted, false);
});

test("simulated external change uses real optimistic versions and reset restores fixtures", async () => {
  const session = createDemoSession();
  const item = (await session.client.snapshot()).items[0];
  await session.simulateExternalChange(item.id);
  const latest = (await session.client.snapshot()).items[0];
  assert.equal(latest.version, item.version + 1);
  await assert.rejects(session.client.execute({ kind: "item.update", id: item.id,
    expectedVersion: item.version, patch: { title: "不能覆盖别人的标题" } }), { code: "CONFLICT" });
  const exported = JSON.parse(await session.client.exportData());
  assert.equal(exported.noteContentsIncluded, false);
  assert.equal(exported.data.items.length, 15);
});
