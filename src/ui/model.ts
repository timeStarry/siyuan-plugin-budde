import type { BuddeState, Command, Item, ItemType, NoteLink } from "../core/types";
import { DEFAULT_REVIEW_DAYS } from "../core/type-config";

export type ViewMode = "pool" | "active" | "board" | "archive";
export type CollectionLayout = "grid" | "list";
export type ActiveFocus = "all" | "review" | "paused" | "completed";
export type SortMode = "manual" | "updated" | "created" | "review" | "type" | "title";

export interface ViewFilters {
  query: string;
  typeId: string;
  includeActiveInPool: boolean;
  activeFocus: ActiveFocus;
  hidePausedOnBoard: boolean;
  sort: SortMode;
  sortAsc?: boolean;
}

export function defaultSortAsc(mode: SortMode): boolean {
  return mode !== "updated" && mode !== "created";
}

export function getItemType(state: BuddeState, item: Item): ItemType | undefined {
  return state.types.find((type) => type.id === item.typeId);
}

export function isCompleted(state: BuddeState, item: Item): boolean {
  if (item.status === "pool") return false;
  return (
    getItemType(state, item)?.stages.find((stage) => stage.id === item.stageId)
      ?.completed ?? false
  );
}

export function needsReview(
  state: BuddeState,
  item: Item,
  now = new Date().toISOString(),
): boolean {
  if (item.status !== "active" || isCompleted(state, item)) return false;
  const type = getItemType(state, item);
  const days = type?.reviewDays === undefined ? DEFAULT_REVIEW_DAYS : type.reviewDays;
  if (days === null || days <= 0) return false;
  const anchor = item.reviewedAt ?? item.updatedAt;
  return Date.parse(now) - Date.parse(anchor) >= days * 86_400_000;
}

export function matchesQuery(item: Item, rawQuery: string): boolean {
  const q = rawQuery.trim().toLocaleLowerCase();
  if (!q) return true;
  if (item.title.toLocaleLowerCase().includes(q)) return true;
  if (item.nextStep.toLocaleLowerCase().includes(q)) return true;
  if (item.description.toLocaleLowerCase().includes(q)) return true;
  return item.links.some(
    (link) =>
      link.title.toLocaleLowerCase().includes(q) ||
      (link.hpath?.toLocaleLowerCase().includes(q) ?? false),
  );
}

export function sortItems(
  state: BuddeState,
  items: Item[],
  mode: SortMode = "manual",
  now = new Date().toISOString(),
  sortAsc?: boolean,
): Item[] {
  const asc = sortAsc ?? defaultSortAsc(mode);
  const typeIndex = new Map(state.types.map((type, index) => [type.id, index]));

  return [...items].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (mode === "updated") {
      const cmp = asc
        ? a.updatedAt.localeCompare(b.updatedAt)
        : b.updatedAt.localeCompare(a.updatedAt);
      return cmp || a.order - b.order;
    }
    if (mode === "created") {
      const cmp = asc
        ? a.createdAt.localeCompare(b.createdAt)
        : b.createdAt.localeCompare(a.createdAt);
      return cmp || a.order - b.order;
    }
    if (mode === "type") {
      const ta = typeIndex.get(a.typeId) ?? Number.MAX_SAFE_INTEGER;
      const tb = typeIndex.get(b.typeId) ?? Number.MAX_SAFE_INTEGER;
      const cmp = asc ? ta - tb : tb - ta;
      return cmp || a.order - b.order || b.updatedAt.localeCompare(a.updatedAt);
    }
    if (mode === "title") {
      const cmp = a.title.localeCompare(b.title, "zh-CN", { numeric: true });
      return (asc ? cmp : -cmp) || a.order - b.order;
    }
    if (mode === "review") {
      const ra = needsReview(state, a, now);
      const rb = needsReview(state, b, now);
      if (ra !== rb) return ra ? -1 : 1;
      const aa = a.reviewedAt ?? a.updatedAt;
      const ab = b.reviewedAt ?? b.updatedAt;
      const cmp = asc ? aa.localeCompare(ab) : ab.localeCompare(aa);
      return cmp || a.order - b.order;
    }
    const manualCmp = a.order - b.order || b.createdAt.localeCompare(a.createdAt);
    return asc ? manualCmp : -manualCmp;
  });
}

export function selectPoolItems(
  state: BuddeState,
  filters: Pick<ViewFilters, "query" | "typeId" | "includeActiveInPool" | "sort" | "sortAsc">,
  now?: string,
): Item[] {
  const matched = state.items.filter((item) => {
    if (item.status === "archived") return false;
    if (!filters.includeActiveInPool && item.status !== "pool") return false;
    if (filters.typeId && item.typeId !== filters.typeId) return false;
    return matchesQuery(item, filters.query);
  });
  return sortItems(state, matched, filters.sort, now, filters.sortAsc);
}

export function selectActiveItems(
  state: BuddeState,
  filters: Pick<ViewFilters, "query" | "typeId" | "activeFocus" | "sort" | "sortAsc">,
  now = new Date().toISOString(),
): Item[] {
  const matched = state.items.filter((item) => {
    if (item.status === "pool" || item.status === "archived") return false;
    if (filters.typeId && item.typeId !== filters.typeId) return false;
    if (!matchesQuery(item, filters.query)) return false;

    const completed = isCompleted(state, item);
    switch (filters.activeFocus) {
      case "review":
        return needsReview(state, item, now);
      case "paused":
        return item.status === "paused";
      case "completed":
        return item.status === "active" && completed;
      case "all":
      default:
        return item.status === "active" && !completed;
    }
  });
  return sortItems(state, matched, filters.sort, now, filters.sortAsc);
}

export function selectBoardItems(
  state: BuddeState,
  typeId: string,
  filters: Pick<ViewFilters, "query" | "hidePausedOnBoard">,
): Item[] {
  const matched = state.items.filter((item) => {
    if (item.typeId !== typeId) return false;
    if (item.status === "pool" || item.status === "archived") return false;
    if (filters.hidePausedOnBoard && item.status === "paused") return false;
    return matchesQuery(item, filters.query);
  });
  return sortItems(state, matched, "manual");
}

export function selectArchiveItems(
  state: BuddeState,
  filters: Pick<ViewFilters, "query" | "typeId" | "sort" | "sortAsc">,
  now?: string,
): Item[] {
  const matched = state.items.filter((item) => {
    if (item.status !== "archived") return false;
    if (filters.typeId && item.typeId !== filters.typeId) return false;
    return matchesQuery(item, filters.query);
  });
  const effectiveSort = filters.sort === "manual" ? "updated" : filters.sort;
  return sortItems(state, matched, effectiveSort, now, filters.sortAsc);
}

export function getWorkspaceCounts(state: BuddeState, now = new Date().toISOString()) {
  let pool = 0;
  let active = 0;
  let review = 0;
  let paused = 0;
  let completed = 0;
  let archived = 0;

  for (const item of state.items) {
    if (item.status === "pool") {
      pool += 1;
    } else if (item.status === "archived") {
      archived += 1;
    } else if (item.status === "paused") {
      paused += 1;
    } else if (item.status === "active") {
      if (isCompleted(state, item)) {
        completed += 1;
      } else {
        active += 1;
        if (needsReview(state, item, now)) review += 1;
      }
    }
  }
  return { pool, active, review, paused, completed, archived };
}

export function getStatusLabel(
  state: BuddeState,
  item: Item,
): { label: string; tone: "default" | "warning" | "success" | "outline" } {
  if (item.status === "archived") return { label: "已归档", tone: "default" };
  if (item.status === "pool") return { label: "想法池", tone: "default" };
  if (item.status === "paused") return { label: "已暂停", tone: "warning" };
  if (isCompleted(state, item)) return { label: "已完成", tone: "success" };
  return { label: "推进中", tone: "outline" };
}

/** Identity belongs to the current capture attempt, preventing duplicate items on retry. */
export class CaptureRequest {
  private command?: Extract<Command, { kind: "item.create" }>;

  prepare(options: {
    title: string;
    typeId?: string;
    status?: "pool" | "active";
    links?: NoteLink[];
  }): Extract<Command, { kind: "item.create" }> {
    const status = options.status ?? "pool";
    if (
      !this.command ||
      this.command.title !== options.title ||
      this.command.typeId !== options.typeId ||
      (this.command.status ?? "pool") !== status
    ) {
      this.command = {
        kind: "item.create",
        requestId: crypto.randomUUID(),
        title: options.title,
        status,
        ...(options.typeId ? { typeId: options.typeId } : {}),
        ...(options.links?.length ? { links: options.links } : {}),
      };
    }
    return structuredClone(this.command);
  }

  success(): void {
    this.command = undefined;
  }
}
