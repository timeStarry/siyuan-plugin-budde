import type { CSSProperties, HTMLAttributes } from "react";
import type { BuddeState, Item, ItemPriority } from "../core/types";
import { getStageCriteriaSummary, isCompleted, needsReview } from "./model";
import { PriorityBadge, TypeBadge } from "./type-presentation";
import { Icon } from "./components/icons";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "./components/ui/dropdown-menu";
import { cn } from "./lib/utils";

export interface ItemCardActions {
  onSelect(item: Item): void;
  onPromote?(item: Item): void;
  onTogglePin?(item: Item): void;
  onSetPriority?(item: Item, priority: ItemPriority | null): void;
  onMoveStage?(item: Item, stageId: string): void;
  onTogglePause?(item: Item): void;
  onArchive?(item: Item, archived: boolean): void;
  onDelete?(item: Item): void;
}

export function ItemCard({
  state,
  item,
  selected,
  board = false,
  overlay = false,
  actions,
  dragRef,
  dragStyle,
  dragAttributes,
  dragListeners,
  isDragging = false,
}: {
  state: BuddeState;
  item: Item;
  selected: boolean;
  board?: boolean;
  overlay?: boolean;
  actions?: ItemCardActions;
  dragRef?: (node: HTMLElement | null) => void;
  dragStyle?: CSSProperties;
  dragAttributes?: HTMLAttributes<HTMLElement>;
  dragListeners?: HTMLAttributes<HTMLElement>;
  isDragging?: boolean;
}) {
  const type = state.types.find((t) => t.id === item.typeId) ?? state.types[0];
  const stage = type.stages.find((s) => s.id === item.stageId) ?? type.stages[0];
  const completed = isCompleted(state, item);
  const review = needsReview(state, item);
  const criteriaSummary = getStageCriteriaSummary(item, stage);
  const showFooter =
    !board ||
    Boolean(item.priority) ||
    item.status === "paused" ||
    review ||
    item.links.length > 0;

  return (
    <article
      ref={dragRef}
      style={dragStyle}
      data-item-id={overlay ? undefined : item.id}
      data-selected={selected || undefined}
      data-dragging={isDragging || undefined}
      onClick={(e) => {
        if (
          !overlay &&
          !(e.target as HTMLElement).closest('button,a,[role="menuitem"]')
        ) {
          actions?.onSelect(item);
        }
      }}
      {...(board && !overlay ? dragAttributes : undefined)}
      {...(board && !overlay ? dragListeners : undefined)}
      className={cn(
        "item-card bd-group/card bd-relative bd-flex bd-min-w-0 bd-flex-col bd-justify-between bd-rounded-lg bd-border bd-bg-card bd-p-3.5 bd-text-foreground bd-transition-all",
        !board && "bd-h-full bd-min-h-[104px] bd-cursor-pointer",
        overlay
          ? "bd-border-foreground/30 bd-shadow-lift"
          : selected
            ? "selected bd-border-foreground/55 bd-ring-1 bd-ring-foreground/20 bd-shadow-sm"
            : "bd-border-border bd-shadow-xs hover:bd-border-foreground/25",
        board && !overlay && "bd-touch-none bd-cursor-grab active:bd-cursor-grabbing",
        isDragging && "bd-border-dashed bd-opacity-35",
      )}
    >
      <button
        type="button"
        onClick={() => actions?.onSelect(item)}
        tabIndex={overlay ? -1 : undefined}
        className="card-open bd-flex bd-w-full bd-min-w-0 bd-flex-col bd-gap-1.5 bd-rounded-sm bd-text-left focus-visible:bd-outline-none focus-visible:bd-ring-2 focus-visible:bd-ring-ring"
      >
        <div
          className={cn(
            "bd-flex bd-w-full bd-min-w-0 bd-items-start bd-gap-1.5",
            board && !overlay && actions && "bd-pr-6",
          )}
        >
          {item.pinned && (
            <span
              title="已置顶"
              aria-label="已置顶"
              className="bd-mt-0.5 bd-shrink-0 bd-text-foreground"
            >
              <Icon name="pin" />
            </span>
          )}
          <span
            className={cn(
              "card-title bd-min-w-0 bd-flex-1 bd-line-clamp-2 bd-break-words bd-text-sm bd-font-medium bd-leading-5",
              completed && item.status === "active" && "bd-text-muted-foreground",
            )}
            title={item.title}
          >
            {item.title}
          </span>
        </div>

        {item.nextStep ? (
          <p className="card-note bd-line-clamp-2 bd-w-full bd-break-words bd-rounded-sm bd-bg-muted/65 bd-px-2 bd-py-1 bd-text-xs bd-leading-5 bd-text-foreground/90">
            <span className="bd-mr-1 bd-text-muted-foreground">下一步:</span>
            {item.nextStep}
          </p>
        ) : item.description ? (
          <p className="card-note bd-line-clamp-2 bd-w-full bd-break-words bd-text-xs bd-leading-5 bd-text-muted-foreground">
            {item.description}
          </p>
        ) : null}
      </button>

      {showFooter && (
        <div className="bd-mt-auto bd-flex bd-min-h-7 bd-w-full bd-min-w-0 bd-items-center bd-justify-between bd-gap-2 bd-pt-2">
          <div className="bd-flex bd-min-w-0 bd-flex-wrap bd-items-center bd-gap-1.5">
            {!board && <TypeBadge type={type} />}
            <PriorityBadge priority={item.priority} />
            {!board && item.status !== "pool" && item.status !== "archived" && (
              <span className="bd-max-w-28 bd-truncate bd-text-xs bd-leading-4 bd-text-muted-foreground">
                {stage.name}
              </span>
            )}
            {item.status !== "pool" && criteriaSummary.total > 0 && criteriaSummary.done > 0 && (
              <span
                className="card-meta bd-inline-flex bd-items-center bd-gap-0.5 bd-text-xs bd-leading-4 bd-text-muted-foreground bd-tabular-nums"
                title={`本阶段检查项已完成 ${criteriaSummary.done} / ${criteriaSummary.total}`}
              >
                <Icon name="checklist" />
                {criteriaSummary.done}/{criteriaSummary.total}
              </span>
            )}
            {item.status === "paused" && <Badge variant="warning">已暂停</Badge>}
            {completed && item.status === "active" && !board && (
              <Badge variant="success">已完成</Badge>
            )}
            {review && (
              <Badge variant="warning">
                <Icon name="clock" />
                需复查
              </Badge>
            )}
            {item.links.length > 0 && (
              <span
                className="card-meta bd-inline-flex bd-items-center bd-gap-1 bd-text-xs bd-leading-4 bd-text-muted-foreground bd-tabular-nums"
                title={`${item.links.length} 篇关联思源笔记`}
              >
                <Icon name="link" />
                {item.links.length}
              </span>
            )}
          </div>

          {!board && !overlay && (
            <div
              className={cn(
                "bd-relative bd-ml-auto bd-flex bd-h-7 bd-shrink-0 bd-items-center bd-justify-end",
                actions &&
                  ((item.status === "pool" && actions.onPromote) ||
                    (item.status === "archived" && actions.onArchive))
                  ? "bd-w-14"
                  : "bd-w-7",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "bd-inline-flex bd-items-center bd-text-muted-foreground/45 bd-transition-all",
                  actions
                    ? "group-hover/card:bd-opacity-0 group-focus-within/card:bd-opacity-0 [@media(hover:none)]:bd-hidden"
                    : "group-hover/card:bd-translate-x-0.5 group-hover/card:bd-text-foreground/75",
                )}
              >
                <Icon name="right" />
              </span>

              {actions && (
                <div
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  className="bd-pointer-events-none bd-absolute bd-inset-y-0 bd-right-0 bd-flex bd-items-center bd-gap-0.5 bd-opacity-0 bd-transition-opacity group-hover/card:bd-pointer-events-auto group-hover/card:bd-opacity-100 group-focus-within/card:bd-pointer-events-auto group-focus-within/card:bd-opacity-100 [@media(hover:none)]:bd-pointer-events-auto [@media(hover:none)]:bd-opacity-100"
                >
                  {item.status === "pool" && actions.onPromote && (
                    <Button
                      variant="ghost"
                      size="iconSm"
                      data-promote={item.id}
                      aria-label="开始推进"
                      title="开始推进"
                      onClick={() => actions.onPromote?.(item)}
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
                    >
                      <Icon name="undo" />
                    </Button>
                  )}
                  <ItemMoreMenu item={item} type={type} actions={actions} />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {board && !overlay && actions && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className="bd-pointer-events-none bd-absolute bd-right-2 bd-top-2 bd-z-10 bd-flex bd-items-center bd-gap-0.5 bd-rounded-md bd-bg-card/90 bd-opacity-0 bd-transition-opacity group-hover/card:bd-pointer-events-auto group-hover/card:bd-opacity-100 group-focus-within/card:bd-pointer-events-auto group-focus-within/card:bd-opacity-100 [@media(hover:none)]:bd-pointer-events-auto [@media(hover:none)]:bd-opacity-100"
        >
          <ItemMoreMenu item={item} type={type} actions={actions} />
        </div>
      )}
    </article>
  );
}

export function ItemMoreMenu({
  item,
  type,
  actions,
}: {
  item: Item;
  type: BuddeState["types"][number];
  actions: ItemCardActions;
}) {
  return (
    <DropdownMenu
      label={`更多操作：${item.title}`}
      trigger={
        <Button
          variant="ghost"
          size="iconSm"
          aria-label={`事项菜单：${item.title}`}
        >
          <Icon name="more" />
        </Button>
      }
    >
      {actions.onTogglePin && (
        <DropdownMenuItem onSelect={() => actions.onTogglePin?.(item)}>
          <Icon name="pin" />
          {item.pinned ? "取消置顶" : "置顶事项"}
        </DropdownMenuItem>
      )}
      {actions.onSetPriority && (
        <>
          <DropdownMenuSeparator />
          <div className="bd-px-2 bd-pt-1 bd-text-[11px] bd-text-muted-foreground">
            优先级
          </div>
          <div className="bd-grid bd-grid-cols-4 bd-gap-1 bd-px-1.5 bd-py-1">
            {(
              [
                ["high", "重点"],
                ["medium", "常规"],
                ["low", "随缘"],
                [null, "未定"],
              ] as const
            ).map(([value, label]) => {
              const active = (item.priority ?? null) === value;
              return (
                <DropdownMenuItem
                  key={label}
                  onSelect={() => actions.onSetPriority?.(item, value)}
                  className={cn(
                    "bd-h-7 bd-w-auto bd-justify-center bd-px-1.5 bd-text-xs",
                    active && "bd-bg-muted bd-font-semibold",
                  )}
                >
                  {label}
                </DropdownMenuItem>
              );
            })}
          </div>
        </>
      )}
      {item.status === "pool" && actions.onPromote && (
        <DropdownMenuItem onSelect={() => actions.onPromote?.(item)}>
          <Icon name="active" />
          开始推进
        </DropdownMenuItem>
      )}
      {(item.status === "active" || item.status === "paused") &&
        actions.onTogglePause && (
          <DropdownMenuItem onSelect={() => actions.onTogglePause?.(item)}>
            <Icon name={item.status === "paused" ? "play" : "pause"} />
            {item.status === "paused" ? "恢复推进" : "暂停推进"}
          </DropdownMenuItem>
        )}
      {actions.onMoveStage && type.stages.length > 1 && (
        <>
          <DropdownMenuSeparator />
          {type.stages.map((entry) => (
            <DropdownMenuItem
              key={entry.id}
              disabled={entry.id === item.stageId && item.status !== "pool"}
              onSelect={() => actions.onMoveStage?.(item, entry.id)}
            >
              <Icon name={entry.completed ? "checkCircle" : "circle"} />
              <span className="bd-truncate">移至「{entry.name}」</span>
            </DropdownMenuItem>
          ))}
        </>
      )}
      <DropdownMenuSeparator />
      {actions.onArchive && (
        <DropdownMenuItem
          onSelect={() => actions.onArchive?.(item, item.status !== "archived")}
        >
          <Icon name={item.status === "archived" ? "undo" : "archive"} />
          {item.status === "archived" ? "移出归档" : "归档事项"}
        </DropdownMenuItem>
      )}
      {actions.onDelete && (
        <DropdownMenuItem destructive onSelect={() => actions.onDelete?.(item)}>
          <Icon name="trash" />
          永久删除
        </DropdownMenuItem>
      )}
    </DropdownMenu>
  );
}
