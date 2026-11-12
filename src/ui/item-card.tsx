import type { CSSProperties, HTMLAttributes } from "react";
import type { BuddeState, Item } from "../core/types";
import { isCompleted, needsReview } from "./model";
import { TypeIcon } from "./type-presentation";
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

  return (
    <article
      ref={dragRef}
      style={dragStyle}
      data-item-id={overlay ? undefined : item.id}
      data-selected={selected || undefined}
      data-dragging={isDragging || undefined}
      {...(board && !overlay ? dragAttributes : undefined)}
      {...(board && !overlay ? dragListeners : undefined)}
      className={cn(
        "item-card bd-group/card bd-relative bd-min-w-0 bd-rounded-lg bd-border bd-bg-card bd-p-3.5 bd-text-foreground bd-transition-all",
        overlay
          ? "bd-border-foreground/30 bd-shadow-lift"
          : selected
            ? "selected bd-border-foreground/55 bd-ring-1 bd-ring-foreground/20 bd-shadow-sm"
            : "bd-border-border bd-shadow-xs hover:bd-border-foreground/25",
        board && !overlay && "bd-touch-none bd-cursor-grab active:bd-cursor-grabbing",
        isDragging && "bd-border-dashed bd-opacity-35",
      )}
    >
      <div className="bd-flex bd-items-start bd-justify-between bd-gap-2">
        <button
          type="button"
          onClick={() => actions?.onSelect(item)}
          tabIndex={overlay ? -1 : undefined}
          className="card-open bd-flex bd-min-w-0 bd-flex-1 bd-flex-col bd-gap-1.5 bd-rounded-sm bd-text-left focus-visible:bd-outline-none focus-visible:bd-ring-2 focus-visible:bd-ring-ring"
        >
          <div className="bd-flex bd-w-full bd-min-w-0 bd-items-start bd-gap-1.5">
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

          <div className="bd-flex bd-flex-wrap bd-items-center bd-gap-1.5">
            {!board && (
              <span className="card-meta bd-inline-flex bd-max-w-full bd-items-center bd-gap-1 bd-text-xs bd-leading-4 bd-text-muted-foreground">
                <TypeIcon type={type} />
                <span className="bd-truncate">
                  {type.name}
                  {item.status !== "pool" ? ` · ${stage.name}` : ""}
                </span>
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

          {item.links.length > 0 && (
            <span className="card-meta bd-inline-flex bd-items-center bd-gap-1 bd-text-xs bd-leading-4 bd-text-muted-foreground bd-tabular-nums">
              <Icon name="link" />
              {item.links.length} 篇关联笔记
            </span>
          )}
        </button>

        {!overlay && actions && (
          <div
            onPointerDown={(e) => e.stopPropagation()}
            className="bd-flex bd-shrink-0 bd-items-center bd-gap-0.5 bd-opacity-0 bd-transition-opacity group-hover/card:bd-opacity-100 group-focus-within/card:bd-opacity-100 [@media(hover:none)]:bd-opacity-100"
          >
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
          </div>
        )}
      </div>

      {!overlay && actions && item.status === "pool" && actions.onPromote && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className="bd-mt-2.5 bd-flex bd-items-center bd-justify-between bd-border-t bd-border-border/60 bd-pt-2"
        >
          <Button
            size="sm"
            variant="ghost"
            data-promote={item.id}
            onClick={() => actions.onPromote?.(item)}
            className="bd-h-7 bd-px-2 bd-text-xs bd-text-foreground hover:bd-bg-muted"
          >
            <Icon name="active" />
            开始推进
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => actions.onSelect(item)}
            className="bd-h-7 bd-px-2 bd-text-xs"
          >
            展开详情
            <Icon name="right" />
          </Button>
        </div>
      )}

      {!overlay && actions && item.status === "archived" && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className="bd-mt-2.5 bd-flex bd-items-center bd-justify-between bd-border-t bd-border-border/60 bd-pt-2"
        >
          {actions.onArchive && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => actions.onArchive?.(item, false)}
              className="bd-h-7 bd-px-2 bd-text-xs bd-text-foreground"
            >
              <Icon name="undo" />
              移出归档
            </Button>
          )}
          {actions.onDelete && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => actions.onDelete?.(item)}
              className="bd-h-7 bd-px-2 bd-text-xs bd-text-destructive hover:bd-bg-destructive/10 hover:bd-text-destructive"
            >
              <Icon name="trash" />
              删除
            </Button>
          )}
        </div>
      )}
    </article>
  );
}
