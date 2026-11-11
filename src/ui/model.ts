import type { BuddeState, Command, Item } from "../core/types";

export type View = "pool" | "board" | "active" | "archive";
export interface Filters { query: string; typeId: string; unpromotedOnly: boolean }
export function isCompleted(state: BuddeState, item: Item): boolean {
  return state.types.find(type => type.id === item.typeId)?.stages.find(stage => stage.id === item.stageId)?.completed ?? false;
}
export function needsReview(state: BuddeState, item: Item, now = new Date().toISOString()): boolean {
  return item.promoted && !item.archived && !isCompleted(state, item) && item.reviewedAt !== null && Date.parse(now) - Date.parse(item.reviewedAt) >= 14 * 86400000;
}
export function selectItems(state: BuddeState, view: View, filters: Filters): Item[] {
  const query = filters.query.trim().toLocaleLowerCase();
  return state.items.filter(item => {
    const eligible = view === "archive" ? item.archived : !item.archived && (view === "pool" || (view === "board" ? item.promoted : item.promoted && !item.paused && !isCompleted(state, item)));
    return eligible && (!filters.typeId || item.typeId === filters.typeId) && (view !== "pool" || !filters.unpromotedOnly || !item.promoted) && (!query || item.title.toLocaleLowerCase().includes(query));
  });
}
/** Identity belongs to the current capture attempt, not to a title or a view. */
export class CaptureRequest {
  private command?: Extract<Command, { kind: "item.create" }>;
  prepare(title: string, typeId?: string): Extract<Command, { kind: "item.create" }> {
    if (!this.command || this.command.title !== title || this.command.typeId !== typeId) this.command = { kind: "item.create", requestId: crypto.randomUUID(), title, ...(typeId ? { typeId } : {}) };
    return { ...this.command };
  }
  success(): void { this.command = undefined; }
}
