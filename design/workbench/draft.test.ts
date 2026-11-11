import test from "node:test";
import assert from "node:assert/strict";
import { createDemoSession } from "./model";
import { DraftSession } from "./draft";

for (const mode of ["reject-next", "conflict"] as const) {
  test(`${mode}: failed save preserves all local input and original version`, async () => {
    const session = createDemoSession();
    const original = (await session.client.snapshot()).items[0];
    const draft = new DraftSession();
    draft.select(original);
    draft.edit({ title: "本地标题", nextStep: "本地下一步", description: "本地说明", links: [
      { id: "local-link", target: "siyuan://blocks/20260101000000-demo001", title: "示例", role: "outcome" },
    ] });
    if (mode === "conflict") await session.simulateExternalChange(original.id);
    else session.armFault(mode);
    await assert.rejects(draft.save(session.client));
    assert.equal(draft.dirty, true);
    assert.equal(draft.item!.title, "本地标题");
    assert.equal(draft.item!.nextStep, "本地下一步");
    assert.equal(draft.item!.description, "本地说明");
    assert.equal(draft.item!.links[0].role, "outcome");
    assert.equal(draft.item!.version, original.version);
    assert.equal(draft.status, mode === "conflict" ? "conflict" : "error");
    assert.ok(draft.error);
    if (mode !== "conflict") {
      const state = await draft.save(session.client);
      assert.equal(draft.dirty, false);
      assert.equal(draft.status, "saved");
      assert.equal(draft.item!.version, original.version + 1);
      assert.equal(state.items[0].title, "本地标题");
    }
  });
}

test("selection cloning, same-item selection and refresh preserve dirty input", async () => {
  const session = createDemoSession();
  const original = (await session.client.snapshot()).items[0];
  const draft = new DraftSession();
  draft.select(original);
  draft.edit({ title: "还没保存" });
  draft.select(original);
  assert.equal(draft.item!.title, "还没保存");
  assert.notEqual(draft.item, original);
  assert.notEqual(original.title, "还没保存");
  draft.discard(original);
  assert.equal(draft.item!.title, original.title);
  assert.equal(draft.dirty, false);
});

test("action and edits commit as one update, failed action never changes local committed flags", async () => {
  const session = createDemoSession();
  const original = (await session.client.snapshot()).items.find((item) => !item.paused && item.promoted)!;
  const draft = new DraftSession();
  draft.select(original);
  draft.edit({ description: "一起保存的修改" });
  session.armFault("reject-next");
  await assert.rejects(draft.save(session.client, { paused: true }));
  assert.equal(draft.item!.paused, false);
  const state = await draft.save(session.client, { paused: true });
  const result = state.items.find((item) => item.id === original.id)!;
  assert.equal(result.paused, true);
  assert.equal(result.description, "一起保存的修改");
  assert.equal(result.version, original.version + 1);
  assert.equal(result.stageId, original.stageId);
});

test("saving guards duplicate commands and retains the pending input until commitment", async () => {
  const session = createDemoSession();
  const draft = new DraftSession();
  draft.select((await session.client.snapshot()).items[0]);
  draft.edit({ nextStep: "稍后才保存成功" });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const client = { ...session.client, async execute(command: Parameters<typeof session.client.execute>[0]) {
    await gate;
    return session.client.execute(command);
  } };
  const pending = draft.save(client);
  assert.equal(draft.status, "saving");
  assert.equal(draft.dirty, true);
  await assert.rejects(draft.save(client), /保存中/);
  release();
  await pending;
  assert.equal(draft.status, "saved");
  assert.equal(draft.dirty, false);
});
