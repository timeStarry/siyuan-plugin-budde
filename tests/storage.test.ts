import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import { mkdirSync, renameSync } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { NodeFileStore } from "../src/platform/node-file-store";
import { parseNoteId, SiYuanNotes } from "../src/platform/siyuan-notes";
import type { BuddeState } from "../src/core/types";

const initial = (): BuddeState => ({
  schemaVersion: 2,
  revision: 0,
  types: [],
  items: [],
  requests: {},
});
function validate(value: unknown): BuddeState {
  const state = value as BuddeState;
  assert.equal(state.schemaVersion, 2);
  assert.ok(Number.isInteger(state.revision));
  assert.ok(Array.isArray(state.items));
  return state;
}
async function fixture(t: TestContext) {
  const data = await fs.mkdtemp(path.join(os.tmpdir(), "budde-storage-test-"));
  t.after(() => {
    const resolved = path.resolve(data);
    assert.ok(
      resolved.startsWith(
        path.resolve(os.tmpdir()) + path.sep + "budde-storage-test-",
      ),
    );
    return fs.rm(resolved, { recursive: true, force: true });
  });
  return { data, store: new NodeFileStore(data, initial, validate) };
}

test("independent instances serialize simultaneous transactions and persist only committed data", async (t) => {
  const { data, store } = await fixture(t);
  const other = new NodeFileStore(data, initial, validate);
  await Promise.all(
    Array.from({ length: 24 }, (_, n) =>
      (n % 2 ? store : other).transaction((state) => {
        state.revision += 1;
        return state.revision;
      }),
    ),
  );
  assert.equal(
    (await new NodeFileStore(data, initial, validate).read()).revision,
    24,
  );
});

test("repeated exclusive-lock turnover tolerates Windows delete-pending contention", async (t) => {
  const { data, store } = await fixture(t);
  // A fresh instance for every concurrent operation reproduces the renderer
  // race at wx-open after another instance has just unlinked the gate.
  for (let round = 0; round < 5; round++) {
    const results = await Promise.allSettled(
      Array.from({ length: 32 }, () =>
        new NodeFileStore(data, initial, validate, {
          timeoutMs: 15000,
        }).transaction((state) => {
          state.revision += 1;
        }),
      ),
    );
    for (const result of results)
      if (result.status === "rejected") throw result.reason;
    assert.equal((await store.read()).revision, (round + 1) * 32);
  }
});

test("callback rejection rolls back and releases lock", async (t) => {
  const { store } = await fixture(t);
  await assert.rejects(
    store.transaction((state) => {
      state.revision = 9;
      throw new Error("reject");
    }),
    /reject/,
  );
  assert.equal((await store.read()).revision, 0);
  await store.transaction((state) => {
    state.revision = 1;
  });
  assert.equal((await store.read()).revision, 1);
});

test("corrupt or unknown-format data is never replaced with an empty state", async (t) => {
  const { store } = await fixture(t);
  await fs.mkdir(path.dirname(store.filePath), { recursive: true });
  for (const text of [
    "{broken",
    JSON.stringify({ ...initial(), schemaVersion: 999 }),
  ]) {
    await fs.writeFile(store.filePath, text);
    await assert.rejects(store.read(), { code: "INVALID_DATA" });
    await assert.rejects(
      store.transaction((state) => {
        state.revision += 1;
      }),
      { code: "INVALID_DATA" },
    );
    assert.equal(await fs.readFile(store.filePath, "utf8"), text);
  }
});

test("failed rename does not report a committed transaction and cleans temporary files", async (t) => {
  const { store } = await fixture(t);
  await store.transaction((state) => {
    state.revision = 1;
  });
  await assert.rejects(
    store.transaction((state) => {
      state.revision = 2;
      renameSync(store.filePath, `${store.filePath}.saved`);
      mkdirSync(store.filePath);
    }),
    { code: "WRITE_FAILED" },
  );
  const entries = await fs.readdir(path.dirname(store.filePath));
  assert.ok(entries.every((name) => !name.endsWith(".tmp")));
  assert.equal(
    JSON.parse(await fs.readFile(`${store.filePath}.saved`, "utf8")).revision,
    1,
  );
});

function child(code: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const process = spawn(
      globalThis.process.execPath,
      ["--import", "tsx", "--input-type=module", "-e", code],
      { stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
    );
    let stderr = "";
    process.stderr.on("data", (data) => {
      stderr += data;
    });
    process.once("error", reject);
    process.once("exit", (exitCode) =>
      exitCode === 0
        ? resolve(process.pid!)
        : reject(new Error(stderr || `Child exit ${exitCode}`)),
    );
  });
}

test("separate renderer processes coordinate writes to the same data directory", async (t) => {
  const { data, store } = await fixture(t);
  const moduleUrl = pathToFileURL(
    path.resolve("src/platform/node-file-store.ts"),
  ).href;
  const code = `import { NodeFileStore } from ${JSON.stringify(moduleUrl)};
    const store = new NodeFileStore(${JSON.stringify(data)}, ${initial.toString()}, value => value);
    for (let n = 0; n < 24; n++) await store.transaction(state => { state.revision += 1; });`;
  await Promise.all([child(code), child(code)]);
  assert.equal((await store.read()).revision, 48);
});

test("dead main-lock owner recovers under transfer gate; interrupted gate fails closed", async (t) => {
  const { data, store } = await fixture(t);
  await store.transaction((state) => {
    state.revision = 1;
  });
  const canonical = await fs.realpath(path.dirname(store.filePath));
  const key = createHash("sha256")
    .update(process.platform === "win32" ? canonical.toLowerCase() : canonical)
    .digest("hex");
  const root = path.join(os.tmpdir(), "siyuan-budde-locks");
  const lock = path.join(root, `${key}.lock`);
  const gate = path.join(root, `${key}.gate`);
  t.after(async () => {
    await fs.rm(lock, { force: true });
    await fs.rm(gate, { force: true });
  });
  const pid = await child("process.exit(0)");
  await fs.writeFile(
    lock,
    JSON.stringify({ pid, token: "dead-owner", hostname: os.hostname() }),
  );
  await store.transaction((state) => {
    state.revision += 1;
  });
  assert.equal((await store.read()).revision, 2);
  await fs.writeFile(gate, "");
  const quick = new NodeFileStore(data, initial, validate, { timeoutMs: 60 });
  await assert.rejects(
    quick.transaction((state) => {
      state.revision += 1;
    }),
    { code: "LOCK_TIMEOUT" },
  );
  assert.equal((await store.read()).revision, 2);
});

test("note input accepts only IDs, SiYuan links and block references", () => {
  const id = "20260101000000-abcdefg";
  for (const input of [
    id,
    `siyuan://blocks/${id}`,
    `((${id} '标题'))`,
    `((${id}))`,
  ])
    assert.equal(parseNoteId(input), id);
  for (const input of [
    "javascript:alert(1)",
    "https://example.com",
    `${id}' OR 1=1`,
    `siyuan://blocks/${id}?x=1`,
  ])
    assert.throws(() => parseNoteId(input));
});

test("note resolution uses current session and checks existence before opening", async () => {
  const id = "20260101000000-abcdefg";
  const opened: string[] = [];
  let exists = true;
  const bridge = new SiYuanNotes(
    (value) => {
      opened.push(value);
    },
    (async (_url, options) => {
      assert.equal(options?.credentials, "same-origin");
      return new Response(
        JSON.stringify({
          code: 0,
          data: exists ? [{ id, content: "关联标题" }] : [],
        }),
      );
    }) as typeof fetch,
  );
  assert.deepEqual(await bridge.resolve(id), {
    id,
    target: `siyuan://blocks/${id}`,
    title: "关联标题",
  });
  await bridge.open(id);
  exists = false;
  await assert.rejects(bridge.open(id), /不存在/);
  assert.deepEqual(opened, [id]);
});
