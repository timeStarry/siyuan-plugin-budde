import { BuddeService, MemoryStore } from "../../src/core/service";
import type { BuddeClient, BuddeState, Command, Item, NoteBridge } from "../../src/core/types";
import { parseNoteId } from "../../src/platform/siyuan-notes";
import { createDemoState, DEMO_NOTES, DEMO_NOW } from "./fixture";

export type View = "pool" | "board" | "active" | "archive";
export interface Filters { query: string; typeId: string; unpromotedOnly: boolean }
export type Fault = "none" | "reject-next" | "lose-response";
export interface DemoSession {
  client: BuddeClient;
  notes: NoteBridge;
  armFault(mode: Fault): void;
  simulateExternalChange(id: string): Promise<void>;
  reset(): Promise<BuddeState>;
}

export function isCompleted(state: BuddeState, item: Item): boolean {
  return state.types.find((type) => type.id === item.typeId)?.stages.find((stage) => stage.id === item.stageId)?.completed ?? false;
}

export function needsReview(state: BuddeState, item: Item, now: string): boolean {
  return item.promoted && !item.archived && !isCompleted(state, item) && item.reviewedAt !== null &&
    Date.parse(now) - Date.parse(item.reviewedAt) >= 14 * 86400000;
}

export function selectItems(state: BuddeState, view: View, filters: Filters): Item[] {
  const query = filters.query.trim().toLocaleLowerCase();
  return state.items.filter((item) => {
    const eligible = view === "archive" ? item.archived : !item.archived && (
      view === "pool" || (view === "board" ? item.promoted : item.promoted && !item.paused && !isCompleted(state, item))
    );
    return eligible && (!filters.typeId || item.typeId === filters.typeId) &&
      (view !== "pool" || !filters.unpromotedOnly || !item.promoted) &&
      (!query || item.title.toLocaleLowerCase().includes(query));
  });
}

export class CaptureRequest {
  private command?: Extract<Command, { kind: "item.create" }>;
  prepare(title: string, typeId?: string): Extract<Command, { kind: "item.create" }> {
    if (!this.command || this.command.title !== title || this.command.typeId !== typeId) {
      this.command = { kind: "item.create", requestId: crypto.randomUUID(), title, ...(typeId ? { typeId } : {}) };
    }
    return { ...this.command };
  }
  success(): void { this.command = undefined; }
}

export function createDemoSession(): DemoSession {
  let service = new BuddeService(new MemoryStore(createDemoState()), () => DEMO_NOW);
  let fault: Fault = "none";
  const resolve: NoteBridge["resolve"] = async (input) => {
    const id = parseNoteId(input);
    const note = DEMO_NOTES.find((entry) => entry.id === id);
    if (!note) throw new Error("这条示例笔记不存在或不可访问，已保留原关联。");
    return { target: `siyuan://blocks/${id}`, title: note.title };
  };
  return {
    client: {
      snapshot: () => service.snapshot(),
      exportData: () => service.exportData(),
      async execute(command) {
        const armed = fault;
        fault = "none";
        if (armed === "reject-next") throw new Error("模拟保存失败。输入已保留，可以重试。");
        const result = await service.execute(command);
        if (armed === "lose-response") throw new Error("模拟响应丢失。请用原输入重试，重复创建会被阻止。");
        return result;
      },
    },
    notes: { resolve, async open(target) { await resolve(target); } },
    armFault(mode) { fault = mode; },
    async simulateExternalChange(id) {
      const state = await service.snapshot();
      const item = state.items.find((entry) => entry.id === id);
      if (!item) throw new Error("请先选择一个事项。");
      await service.execute({ kind: "item.update", id, expectedVersion: item.version,
        patch: { title: `${item.title.slice(0, 480)} · 外部修改` } });
    },
    async reset() {
      fault = "none";
      service = new BuddeService(new MemoryStore(createDemoState()), () => DEMO_NOW);
      return service.snapshot();
    },
  };
}
