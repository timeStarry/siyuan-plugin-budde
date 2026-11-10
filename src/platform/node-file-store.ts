import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { createHash, randomUUID } from "node:crypto";
import type { BuddeState, StateStore } from "../core/types";

type Owner = { pid: number; token: string; hostname: string };
export class StorageError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "StorageError";
  }
}
const pause = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));
const codeOf = (error: unknown) => (error as NodeJS.ErrnoException)?.code;
// Serialize short ownership transfers inside one renderer as well. Without
// this, dozens of queued UI calls can starve the transaction trying to release
// its main lock while all of them repeatedly contend for the transfer gate.
const localGateTails = new Map<string, Promise<void>>();

/** Same-machine desktop coordination only. File sync is not a distributed lock. */
export class NodeFileStore implements StateStore {
  readonly filePath: string;
  private paths?: Promise<{ lock: string; gate: string }>;
  private readonly timeoutMs: number;

  constructor(
    dataDir: string,
    private readonly createInitial: () => BuddeState,
    private readonly validate: (value: unknown) => BuddeState,
    options: { timeoutMs?: number } = {},
  ) {
    this.filePath = path.join(
      path.resolve(dataDir),
      "storage",
      "petal",
      "siyuan-plugin-budde",
      "state.json",
    );
    this.timeoutMs = options.timeoutMs ?? 5000;
  }

  private lockPaths() {
    return (this.paths ??= (async () => {
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      // Resolve aliases so two windows addressing the same workspace share a lock.
      const canonical = await fs.realpath(path.dirname(this.filePath));
      const key = createHash("sha256")
        .update(
          process.platform === "win32" ? canonical.toLowerCase() : canonical,
        )
        .digest("hex");
      const root = path.join(os.tmpdir(), "siyuan-budde-locks");
      await fs.mkdir(root, { recursive: true });
      return {
        lock: path.join(root, `${key}.lock`),
        gate: path.join(root, `${key}.gate`),
      };
    })());
  }

  private async ownerAt(file: string): Promise<Owner> {
    try {
      const owner = JSON.parse(await fs.readFile(file, "utf8")) as Owner;
      if (
        !Number.isSafeInteger(owner.pid) ||
        owner.pid <= 0 ||
        typeof owner.token !== "string" ||
        !owner.token ||
        owner.hostname !== os.hostname()
      ) {
        throw new Error("Invalid owner record");
      }
      return owner;
    } catch (error) {
      throw new StorageError(
        "LOCK_UNCERTAIN",
        `无法确认 Budde 写入锁的归属。请关闭其他 Budde 窗口后检查锁文件：${file}`,
        { cause: error },
      );
    }
  }

  private isAlive(owner: Owner): boolean {
    try {
      process.kill(owner.pid, 0);
      return true;
    } catch (error) {
      return codeOf(error) !== "ESRCH";
    }
  }

  private async createOwner(file: string, owner: Owner, deadline: number) {
    let handle: fs.FileHandle;
    // Windows can keep an unlinked file delete-pending while another process
    // briefly has a handle. CREATE_NEW then reports EPERM/EACCES, not EEXIST.
    // Retry only the exclusive open, never the owner write: a failed write may
    // already have created the file and must remain a fail-closed uncertain lock.
    // A real permission denial is preserved after this short bounded retry.
    const retryUntil = Math.min(deadline, Date.now() + 200);
    while (true) {
      try {
        handle = await fs.open(file, "wx", 0o600);
        break;
      } catch (error) {
        const transient =
          process.platform === "win32" &&
          ["EPERM", "EACCES", "EBUSY"].includes(codeOf(error) ?? "");
        if (!transient || Date.now() >= retryUntil) throw error;
        await pause(10);
      }
    }
    try {
      await handle.writeFile(JSON.stringify(owner), "utf8");
    } finally {
      await handle.close();
    }
  }

  /**
   * All main-lock transfers and recovery run under this short exclusive gate.
   * This avoids two stale-lock observers deleting a newly acquired main lock.
   * A crash *inside* the gate fails closed; we never guess that an empty or
   * interrupted gate can be deleted. Recovery then requires closed instances.
   */
  private async withGate<T>(
    gate: string,
    deadline: number,
    action: () => Promise<T>,
  ): Promise<T> {
    const previous = localGateTails.get(gate) ?? Promise.resolve();
    let finish!: () => void;
    const turn = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const tail = previous.then(() => turn);
    localGateTails.set(gate, tail);
    await previous;
    try {
      if (Date.now() >= deadline)
        throw new StorageError(
          "LOCK_TIMEOUT",
          "其他 Budde 操作仍在写入，请稍后重试。",
        );
      return await this.withGateFile(gate, deadline, action);
    } finally {
      finish();
      if (localGateTails.get(gate) === tail) localGateTails.delete(gate);
    }
  }

  private async withGateFile<T>(
    gate: string,
    deadline: number,
    action: () => Promise<T>,
  ): Promise<T> {
    const owner = {
      pid: process.pid,
      token: randomUUID(),
      hostname: os.hostname(),
    };
    while (true) {
      try {
        await this.createOwner(gate, owner, deadline);
        break;
      } catch (error) {
        if (codeOf(error) !== "EEXIST") throw error;
        if (Date.now() >= deadline) {
          throw new StorageError(
            "LOCK_TIMEOUT",
            `Budde 正在等待其他窗口写入；若此前发生异常退出，请关闭所有 Budde 窗口后检查锁文件：${gate}`,
          );
        }
        await pause(10 + Math.floor(Math.random() * 20));
      }
    }
    try {
      return await action();
    } finally {
      const current = await this.ownerAt(gate);
      if (current.token !== owner.token)
        throw new StorageError(
          "LOCK_LOST",
          "Budde 写入锁异常变化，已停止写入。",
        );
      await fs.unlink(gate);
    }
  }

  private async acquire() {
    const { lock, gate } = await this.lockPaths();
    const deadline = Date.now() + this.timeoutMs;
    const owner = {
      pid: process.pid,
      token: randomUUID(),
      hostname: os.hostname(),
    };
    while (true) {
      const acquired = await this.withGate(gate, deadline, async () => {
        try {
          await this.createOwner(lock, owner, deadline);
          return true;
        } catch (error) {
          if (codeOf(error) !== "EEXIST") throw error;
        }
        const previous = await this.ownerAt(lock);
        if (this.isAlive(previous)) return false;
        await fs.unlink(lock);
        await this.createOwner(lock, owner, deadline);
        return true;
      });
      if (acquired) {
        return async () =>
          this.withGate(gate, Date.now() + this.timeoutMs, async () => {
            const current = await this.ownerAt(lock);
            if (current.token !== owner.token)
              throw new StorageError(
                "LOCK_LOST",
                "Budde 写入锁异常变化，已停止写入。",
              );
            await fs.unlink(lock);
          });
      }
      if (Date.now() >= deadline)
        throw new StorageError(
          "LOCK_TIMEOUT",
          "其他 Budde 窗口仍在写入，请稍后重试。",
        );
      await pause(20 + Math.floor(Math.random() * 30));
    }
  }

  async read(): Promise<BuddeState> {
    let text: string;
    try {
      text = await fs.readFile(this.filePath, "utf8");
    } catch (error) {
      if (codeOf(error) === "ENOENT")
        return structuredClone(this.validate(this.createInitial()));
      throw new StorageError(
        "READ_FAILED",
        "Budde 数据读取失败，未创建替代数据。",
        { cause: error },
      );
    }
    try {
      return structuredClone(this.validate(JSON.parse(text)));
    } catch (error) {
      throw new StorageError(
        "INVALID_DATA",
        "Budde 数据格式异常，已保留原文件。请先备份并检查数据，不能直接覆盖。",
        { cause: error },
      );
    }
  }

  private async persist(state: BuddeState) {
    const temporary = `${this.filePath}.${randomUUID()}.tmp`;
    let handle: fs.FileHandle | undefined;
    try {
      handle = await fs.open(temporary, "wx", 0o600);
      await handle.writeFile(JSON.stringify(state, null, 2), "utf8");
      await handle.sync();
      await handle.close();
      handle = undefined;
      // Same-directory rename replaces the old snapshot atomically.
      await fs.rename(temporary, this.filePath);
    } catch (error) {
      throw new StorageError(
        "WRITE_FAILED",
        "Budde 保存失败，请保留当前输入并重试。",
        { cause: error },
      );
    } finally {
      await handle?.close().catch(() => undefined);
      await fs.unlink(temporary).catch(() => undefined);
    }
  }

  async transaction<T>(mutate: (draft: BuddeState) => T): Promise<T> {
    const release = await this.acquire();
    try {
      const draft = await this.read();
      const previous = JSON.stringify(draft);
      const result = mutate(draft);
      if (result instanceof Promise)
        throw new StorageError("ASYNC_MUTATION", "存储事务必须同步修改数据。");
      this.validate(draft);
      if (JSON.stringify(draft) !== previous) await this.persist(draft);
      return result;
    } finally {
      await release();
    }
  }
}
