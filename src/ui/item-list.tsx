import type { BuddeState, Item } from "../core/types";
import {
  defaultSortAsc,
  isCompleted,
  needsReview,
  type SortMode,
  type ViewFilters,
} from "./model";
import { ItemMoreMenu, type ItemCardActions } from "./item-card";
import { TypeBadge } from "./type-presentation";
import { Icon } from "./components/icons";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { cn } from "./lib/utils";

function formatRelativeTime(iso: string): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return "";
  const diffMs = Date.now() - ts;
  if (diffMs < 60_000) return "刚刚";
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}天前`;
  const date = new Date(ts);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return year === new Date().getFullYear()
    ? `${month}-${day}`
    : `${year}-${month}-${day}`;
}

export function ItemListView({
  state,
  items,
  selectedId,
  filters,
  onFiltersChange,
  actions,
}: {
  state: BuddeState;
  items: Item[];
  selectedId: string;
  filters: ViewFilters;
  onFiltersChange(patch: Partial<ViewFilters>): void;
  actions: ItemCardActions;
}) {
  const toggleColumnSort = (col: SortMode) => {
    if (filters.sort !== col) {
      onFiltersChange({ sort: col, sortAsc: defaultSortAsc(col) });
    } else {
      const currentAsc = filters.sortAsc ?? defaultSortAsc(col);
      onFiltersChange({ sortAsc: !currentAsc });
    }
  };

  return (
    <div
      data-list-view="true"
      className="bd-overflow-hidden bd-rounded-lg bd-border bd-border-border bd-bg-card bd-shadow-xs"
    >
      <div
        role="row"
        className="bd-flex bd-h-8 bd-items-center bd-gap-3 bd-border-b bd-border-border bd-bg-muted/50 bd-px-3.5 bd-text-xs bd-font-medium bd-text-muted-foreground"
      >
        <div className="bd-min-w-0 bd-flex-1">
          <SortHeaderButton
            label="事项"
            active={filters.sort === "title"}
            asc={filters.sortAsc ?? defaultSortAsc("title")}
            onClick={() => toggleColumnSort("title")}
          />
        </div>
        <div className="bd-w-28 bd-shrink-0 [@container(max-width:440px)]:bd-hidden">
          <SortHeaderButton
            label="类型"
            active={filters.sort === "type"}
            asc={filters.sortAsc ?? defaultSortAsc("type")}
            onClick={() => toggleColumnSort("type")}
          />
        </div>
        <div className="bd-w-24 bd-shrink-0 [@container(max-width:680px)]:bd-hidden">
          阶段
        </div>
        <div className="bd-w-12 bd-shrink-0 bd-text-right [@container(max-width:780px)]:bd-hidden">
          笔记
        </div>
        <div className="bd-flex bd-w-20 bd-shrink-0 bd-justify-end [@container(max-width:560px)]:bd-hidden">
          <SortHeaderButton
            label="更新"
            align="right"
            active={filters.sort === "updated"}
            asc={filters.sortAsc ?? defaultSortAsc("updated")}
            onClick={() => toggleColumnSort("updated")}
          />
        </div>
        <div
          aria-hidden="true"
          className="bd-w-14 bd-shrink-0 [@container(max-width:440px)]:bd-w-7"
        />
      </div>

      <div className="bd-divide-y bd-divide-border/60">
        {items.map((item) => {
          const type = state.types.find((t) => t.id === item.typeId) ?? state.types[0];
          const stage = type.stages.find((s) => s.id === item.stageId) ?? type.stages[0];
          const completed = isCompleted(state, item);
          const review = needsReview(state, item);
          const selected = selectedId === item.id;
          const summary = item.nextStep
            ? `下一步: ${item.nextStep}`
            : item.description;

          return (
            <div
              key={item.id}
              data-list-row={item.id}
              data-item-id={item.id}
              data-selected={selected || undefined}
              onClick={(e) => {
                if (!(e.target as HTMLElement).closest('button,a,[role="menuitem"]')) {
                  actions.onSelect(item);
                }
              }}
              className={cn(
                "list-row bd-group/row bd-relative bd-flex bd-h-[42px] bd-cursor-pointer bd-items-center bd-gap-3 bd-px-3.5 bd-text-sm bd-transition-colors",
                selected
                  ? "selected bd-bg-muted/80"
                  : "hover:bd-bg-muted/40",
              )}
            >
              <button
                type="button"
                onClick={() => actions.onSelect(item)}
                className="card-open bd-flex bd-min-w-0 bd-flex-1 bd-items-center bd-gap-1.5 bd-rounded-sm bd-text-left focus-visible:bd-outline-none focus-visible:bd-ring-2 focus-visible:bd-ring-ring"
              >
                {item.pinned && (
                  <span
                    title="已置顶"
                    aria-label="已置顶"
                    className="bd-shrink-0 bd-text-foreground"
                  >
                    <Icon name="pin" />
                  </span>
                )}
                <span
                  className={cn(
                    "card-title bd-truncate bd-font-medium",
                    completed && item.status === "active" && "bd-text-muted-foreground",
                  )}
                  title={item.title}
                >
                  {item.title}
                </span>
                {item.status === "paused" && (
                  <Badge variant="warning" className="bd-shrink-0">
                    已暂停
                  </Badge>
                )}
                {completed && item.status === "active" && (
                  <Badge variant="success" className="bd-shrink-0">
                    已完成
                  </Badge>
                )}
                {review && (
                  <Badge variant="warning" className="bd-shrink-0">
                    <Icon name="clock" />
                    需复查
                  </Badge>
                )}
                {summary && (
                  <span className="bd-min-w-0 bd-flex-1 bd-truncate bd-text-xs bd-text-muted-foreground [@container(max-width:600px)]:bd-hidden">
                    <span aria-hidden="true" className="bd-mr-1 bd-opacity-50">
                      ·
                    </span>
                    {summary}
                  </span>
                )}
              </button>

              <div className="bd-flex bd-w-28 bd-shrink-0 bd-items-center [@container(max-width:440px)]:bd-hidden">
                <TypeBadge type={type} />
              </div>

              <div className="bd-w-24 bd-shrink-0 bd-truncate bd-text-xs [@container(max-width:680px)]:bd-hidden">
                {item.status === "pool" ? (
                  <span className="bd-text-muted-foreground/75">待孵化</span>
                ) : item.status === "archived" ? (
                  <span className="bd-text-muted-foreground/75">已归档</span>
                ) : (
                  <span className="bd-text-foreground/85">{stage.name}</span>
                )}
              </div>

              <div className="bd-w-12 bd-shrink-0 bd-text-right bd-text-xs bd-text-muted-foreground bd-tabular-nums [@container(max-width:780px)]:bd-hidden">
                {item.links.length > 0 ? (
                  <span
                    className="bd-inline-flex bd-items-center bd-justify-end bd-gap-1"
                    title={`${item.links.length} 篇关联思源笔记`}
                  >
                    <Icon name="link" />
                    {item.links.length}
                  </span>
                ) : (
                  <span className="bd-text-muted-foreground/35">—</span>
                )}
              </div>

              <div
                className="bd-w-20 bd-shrink-0 bd-text-right bd-text-xs bd-text-muted-foreground bd-tabular-nums [@container(max-width:560px)]:bd-hidden"
                title={item.updatedAt}
              >
                {formatRelativeTime(item.updatedAt)}
              </div>

              <div className="bd-relative bd-flex bd-w-14 bd-shrink-0 bd-items-center bd-justify-end [@container(max-width:440px)]:bd-w-7">
                <span
                  aria-hidden="true"
                  className="bd-inline-flex bd-items-center bd-text-muted-foreground/45 bd-transition-opacity group-hover/row:bd-opacity-0 group-focus-within/row:bd-opacity-0 [@media(hover:none)]:bd-hidden"
                >
                  <Icon name="right" />
                </span>
                <div
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  className="bd-pointer-events-none bd-absolute bd-inset-y-0 bd-right-0 bd-flex bd-items-center bd-gap-0.5 bd-opacity-0 bd-transition-opacity group-hover/row:bd-pointer-events-auto group-hover/row:bd-opacity-100 group-focus-within/row:bd-pointer-events-auto group-focus-within/row:bd-opacity-100 [@media(hover:none)]:bd-pointer-events-auto [@media(hover:none)]:bd-opacity-100"
                >
                  {item.status === "pool" && actions.onPromote && (
                    <Button
                      variant="ghost"
                      size="iconSm"
                      data-promote={item.id}
                      aria-label="开始推进"
                      title="开始推进"
                      onClick={() => actions.onPromote?.(item)}
                      className="[@container(max-width:440px)]:bd-hidden"
                    >
                      <Icon name="active" />
                    </Button>
                  )}
                  {item.status === "archived" && actions.onArchive && (
                    <Button
                      variant="ghost"
                      size="iconSm"
                      aria-label="移出归档"
                      title="移出归档"
                      onClick={() => actions.onArchive?.(item, false)}
                      className="[@container(max-width:440px)]:bd-hidden"
                    >
                      <Icon name="undo" />
                    </Button>
                  )}
                  <ItemMoreMenu item={item} type={type} actions={actions} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SortHeaderButton({
  label,
  active,
  asc,
  align = "left",
  onClick,
}: {
  label: string;
  active: boolean;
  asc: boolean;
  align?: "left" | "right";
  onClick(): void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`按${label}排序`}
      className={cn(
        "bd-inline-flex bd-items-center bd-gap-1 bd-rounded-sm bd-py-0.5 bd-transition-colors hover:bd-text-foreground focus-visible:bd-outline-none focus-visible:bd-ring-2 focus-visible:bd-ring-ring",
        align === "right" && "bd-ml-auto",
        active && "bd-font-semibold bd-text-foreground",
      )}
    >
      <span>{label}</span>
      {active && <Icon name={asc ? "sortAsc" : "sortDesc"} />}
    </button>
  );
}
