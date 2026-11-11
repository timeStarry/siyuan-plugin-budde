import type { BuddeClient, BuddeState, Item, ItemPatch } from "../../src/core/types";

const editable = ["title", "typeId", "stageId", "description", "nextStep", "links", "promoted", "paused", "archived", "reviewedAt"] as const;
export class DraftSession {
  item?: Item;
  private base?: Item;
  status: "saved" | "dirty" | "saving" | "error" | "conflict" = "saved";
  error = "";
  get dirty(): boolean { return JSON.stringify(this.item) !== JSON.stringify(this.base); }
  select(item?: Item): void {
    if (item && this.item?.id === item.id) return;
    this.discard(item);
  }
  edit(patch: ItemPatch): void {
    if (!this.item || this.status === "saving") return;
    Object.assign(this.item, structuredClone(patch));
    if (this.status !== "conflict") {
      this.status = this.dirty ? "dirty" : "saved";
      this.error = "";
    }
  }
  discard(latest?: Item): void {
    this.item = latest ? structuredClone(latest) : undefined;
    this.base = latest ? structuredClone(latest) : undefined;
    this.status = "saved";
    this.error = "";
  }
  async save(client: BuddeClient, extra: ItemPatch = {}): Promise<BuddeState> {
    if (this.status === "saving") throw new Error("保存中，请等待当前操作完成。");
    if (!this.item || !this.base) throw new Error("没有选中的事项。");
    const item = this.item;
    const patch = Object.fromEntries(editable.filter((key) => JSON.stringify(item[key]) !== JSON.stringify(this.base![key])).map((key) => [key, item[key]])) as ItemPatch;
    this.status = "saving";
    this.error = "";
    try {
      const result = await client.execute({ kind: "item.update", id: item.id, expectedVersion: this.base.version, patch: { ...patch, ...extra } });
      this.discard(result.state.items.find((entry) => entry.id === item.id));
      return result.state;
    } catch (error) {
      this.status = typeof error === "object" && error !== null && "code" in error && error.code === "CONFLICT" ? "conflict" : "error";
      this.error = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }
}
