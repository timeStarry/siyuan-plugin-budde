import test from "node:test";
import assert from "node:assert/strict";
import { BuddeService, MemoryStore } from "../src/core/service";
import type { BuddeClient } from "../src/core/types";
import { CaptureRequest, needsReview, selectItems } from "../src/ui/model";
import { DraftSession } from "../src/ui/draft";

const filters = { query: "", typeId: "", unpromotedOnly: false };
async function fixture() {
  const client = new BuddeService(new MemoryStore());
  const result = await client.execute({ kind: "item.create", requestId: crypto.randomUUID(), title: "一个想法" });
  return { client, item: result.state.items[0], state: result.state };
}
test("capture retries preserve request identity until success or edited content", () => {
  const capture = new CaptureRequest();
  const first = capture.prepare("想法", "general");
  assert.equal(capture.prepare("想法", "general").requestId, first.requestId);
  assert.notEqual(capture.prepare("想法", "article").requestId, first.requestId);
  capture.success();
  assert.notEqual(capture.prepare("想法", "general").requestId, first.requestId);
});
test("collections distinguish capture, promotion, pause, completion and archive regardless of stage order", async () => {
  const { state, item } = await fixture();
  assert.equal(selectItems(state, "pool", filters).length, 1);
  assert.equal(selectItems(state, "board", filters).length, 0);
  item.promoted = true;
  assert.equal(selectItems(state, "active", filters).length, 1);
  item.paused = true;
  assert.equal(selectItems(state, "active", filters).length, 0);
  assert.equal(selectItems(state, "board", filters).length, 1);
  item.stageId = state.types[0].stages.find(s => s.completed)!.id;
  item.paused = false;
  state.types[0].stages.reverse();
  assert.equal(selectItems(state, "active", filters).length, 0);
  item.archived = true;
  assert.equal(selectItems(state, "pool", filters).length, 0);
  assert.equal(selectItems(state, "archive", filters).length, 1);
});
test("review boundary is based on supplied current time, never mutated by browsing", async () => {
  const { state, item } = await fixture();
  item.promoted = true; item.reviewedAt = "2026-10-28T00:00:00.000Z";
  assert.equal(needsReview(state, item, "2026-11-10T23:59:59.999Z"), false);
  assert.equal(needsReview(state, item, "2026-11-11T00:00:00.000Z"), true);
  selectItems(state, "active", filters);
  assert.equal(item.reviewedAt, "2026-10-28T00:00:00.000Z");
});
for (const mode of ["failure", "conflict"] as const) test(`${mode} retains complete local draft and original version`, async () => {
  const { client, item } = await fixture();
  const draft = new DraftSession(); draft.select(item);
  draft.edit({ title: "本地标题", nextStep: "本地下一步", description: "本地说明", links: [{ id: "local", target: "siyuan://blocks/20260101000000-demo001", title: "资料", role: "reference" }] });
  let failing = true;
  const adapter: BuddeClient = { snapshot: () => client.snapshot(), exportData: () => client.exportData(), execute: command => {
    if (mode === "failure" && failing) return Promise.reject(new Error("写入失败，输入保留"));
    return client.execute(command);
  } };
  if (mode === "conflict") await client.execute({ kind: "item.update", id: item.id, expectedVersion: item.version, patch: { title: "外部标题" } });
  await assert.rejects(draft.save(adapter));
  assert.equal(draft.item!.title, "本地标题"); assert.equal(draft.item!.description, "本地说明"); assert.equal(draft.item!.links.length, 1);
  assert.equal(draft.item!.version, item.version); assert.equal(draft.dirty, true);
  assert.equal(draft.status, mode === "conflict" ? "conflict" : "error");
  if (mode === "failure") { failing = false; await draft.save(adapter); assert.equal(draft.dirty, false); }
});
test("pending save excludes duplicate writes and commits fields and action atomically", async () => {
  const { client, item } = await fixture();
  const draft = new DraftSession(); draft.select(item); draft.edit({ description: "一起提交" });
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const adapter: BuddeClient = { snapshot: () => client.snapshot(), exportData: () => client.exportData(), async execute(command) { await gate; return client.execute(command); } };
  const pending = draft.save(adapter, { promoted: true });
  assert.equal(draft.status, "saving");
  await assert.rejects(draft.save(adapter), /保存中/);
  release(); const state = await pending;
  assert.equal(state.items[0].promoted, true); assert.equal(state.items[0].description, "一起提交"); assert.equal(state.items[0].version, item.version + 1);
});
