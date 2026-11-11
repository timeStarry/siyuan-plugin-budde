import type { BuddeState, Item } from "../../src/core/types";
import { DEMO_NOW } from "./fixture";
import { isCompleted, needsReview, selectItems, type Filters, type View } from "./model";

export function escape(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

export const sprout = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M12 21V11M12 14C5 14 3 10 3 5c5 0 9 2 9 7M12 11C12 5 16 3 21 3c0 5-3 8-9 8"/></svg>';

function itemMarkup(state: BuddeState, item: Item, selected: string, board: boolean): string {
  const type = state.types.find((value) => value.id === item.typeId)!;
  const stage = type.stages.find((value) => value.id === item.stageId)!;
  const badges = [!item.promoted ? "未开始推进" : "", item.paused ? "已暂停" : "", isCompleted(state, item) ? "已完成" : "", needsReview(state, item, DEMO_NOW) ? "需复查" : ""].filter(Boolean);
  return `<article class="item ${board ? "card" : "row"} ${item.id === selected ? "is-selected" : ""}" data-item-id="${escape(item.id)}" ${board ? 'draggable="true"' : ""}>
    <div class="item-content"><button class="item-title" data-open="${escape(item.id)}" ${item.id === selected ? 'aria-current="true"' : ""}>${escape(item.title)}</button>
      <div class="item-meta">${board ? "" : `<span>${escape(type.name)} · ${escape(stage.name)}</span>`}${badges.map((label) => `<span class="badge ${label === "需复查" ? "review" : ""}">${label}</span>`).join("")}</div>
      ${item.nextStep ? `<p class="next-step" title="${escape(item.nextStep)}">${escape(item.nextStep)}</p>` : !board ? '<p class="next-step placeholder">下一步留白也没关系</p>' : ""}
      ${item.links.length ? `<span class="link-count">↗ ${item.links.length} 条笔记关联</span>` : ""}
    </div>
    ${!item.promoted && !item.archived ? `<button class="quiet start-action" data-promote="${escape(item.id)}">开始推进</button>` : ""}
  </article>`;
}

export function renderItems(state: BuddeState, view: View, filters: Filters, selected: string): string {
  const items = selectItems(state, view, filters);
  if (view === "board") {
    const type = state.types.find((value) => value.id === filters.typeId);
    if (!type) return "";
    return type.stages.map((stage) => {
      const group = items.filter((item) => item.stageId === stage.id);
      return `<section class="stage" data-stage-id="${escape(stage.id)}"><h2>${escape(stage.name)} <span>${group.length}</span>${stage.completed ? '<span class="stage-flag">完成阶段</span>' : ""}</h2><div class="stage-items">${group.map((item) => itemMarkup(state, item, selected, true)).join("") || '<p class="empty-column">暂无事项</p>'}</div></section>`;
    }).join("");
  }
  if (!items.length) {
    const filtered = filters.query || filters.typeId || filters.unpromotedOnly;
    const title = filtered ? "没有匹配的事项" : view === "archive" ? "还没有归档事项" : view === "active" ? "现在没有正在推进的事项" : "先留下第一个想法";
    return `<div class="empty-state"><h2>${title}</h2><p>${filtered ? "可以换一个标题关键词，或清除查看条件。" : view === "active" ? "回到想法池，选择值得继续的那一个。" : view === "archive" ? "暂时不需要的事项，可以从详情归档。" : "只需要一个标题，其他内容以后再说。"}</p><button class="quiet" ${filtered ? 'data-action="clear-filters"' : view === "active" ? 'data-view="pool"' : 'data-action="focus-capture"'}>${filtered ? "清除筛选" : view === "active" ? "回到想法池" : "记一个想法"}</button></div>`;
  }
  return items.map((item) => itemMarkup(state, item, selected, false)).join("");
}
