import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  pointerWithin,
  useDroppable,
  type CollisionDetection,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { BuddeState, Item, ItemType, Stage } from "../core/types";
import { isCompleted, selectBoardItems, type ViewFilters } from "./model";
import { useBudde } from "./context";
import { usePane } from "./pane-context";
import { useOwnedSensors } from "./lib/owned-sensors";
import { ItemCard, type ItemCardActions } from "./item-card";
import { TypeIcon } from "./type-presentation";
import { Icon } from "./components/icons";
import { Button } from "./components/ui/button";
import { Badge } from "./components/ui/badge";
import { Input } from "./components/ui/fields";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "./components/ui/dropdown-menu";
import { cn } from "./lib/utils";

const boardCollision: CollisionDetection = (args) => {
  const pointerHits = pointerWithin(args);
  if (pointerHits.length > 0) return pointerHits;
  return closestCorners(args);
};

export function BoardView({
  state,
  boardTypeId,
  onSelectBoardType,
  filters,
  onFiltersChange,
  selectedId,
  cardActions,
  onOpenSettings,
}: {
  state: BuddeState;
  boardTypeId: string;
  onSelectBoardType(typeId: string): void;
  filters: ViewFilters;
  onFiltersChange(patch: Partial<ViewFilters>): void;
  selectedId: string;
  cardActions: ItemCardActions;
  onOpenSettings(target?: { typeId?: string; createNew?: boolean; deleteStageId?: string }): void;
}) {
  const { root } = usePane();
  const { execute, confirm } = useBudde();
  const type = state.types.find((t) => t.id === boardTypeId) ?? state.types[0];
  const boardItems = selectBoardItems(state, type.id, filters);

  const completedOnBoardCount = boardItems.filter(
    (item) => item.status === "active" && isCompleted(state, item),
  ).length;
  const pausedOnBoardCount = state.items.filter(
    (item) => item.typeId === type.id && item.status === "paused",
  ).length;

  const [dragState, setDragState] = useState<{
    item: Item;
    rect: NonNullable<DragStartEvent["active"]["rect"]["current"]["initial"]>;
  } | null>(null);

  const sensors = useOwnedSensors(root, sortableKeyboardCoordinates);
  const rootRect = root.getBoundingClientRect();

  return (
    <div className="bd-flex bd-min-h-0 bd-min-w-0 bd-flex-1 [@container(max-width:760px)]:bd-flex-col">
      <aside
        aria-label="看板类型"
        className="bd-flex bd-w-44 bd-shrink-0 bd-flex-col bd-gap-1 bd-overflow-y-auto bd-border-r bd-border-border bd-bg-muted/55 bd-p-2.5 [@container(max-width:760px)]:bd-w-full [@container(max-width:760px)]:bd-flex-row [@container(max-width:760px)]:bd-items-center [@container(max-width:760px)]:bd-overflow-x-auto [@container(max-width:760px)]:bd-overflow-y-hidden [@container(max-width:760px)]:bd-border-b [@container(max-width:760px)]:bd-border-r-0"
      >
        <div className="bd-flex bd-shrink-0 bd-items-center bd-justify-between bd-px-2 bd-py-1 [@container(max-width:760px)]:bd-px-1">
          <span className="bd-text-xs bd-font-medium bd-text-muted-foreground [@container(max-width:760px)]:bd-sr-only">
            事项类型
          </span>
          <Button
            variant="ghost"
            size="iconSm"
            aria-label="新建类型"
            title="新建类型"
            onClick={() => onOpenSettings({ createNew: true })}
          >
            <Icon name="plus" />
          </Button>
        </div>

        {state.types.map((entry) => {
          const count = state.items.filter(
            (i) =>
              i.typeId === entry.id &&
              (i.status === "active" || i.status === "paused"),
          ).length;
          const active = entry.id === type.id;
          return (
            <div
              key={entry.id}
              data-type-row={entry.id}
              className="bd-group bd-flex bd-min-w-0 bd-items-center bd-gap-0.5 [@container(max-width:760px)]:bd-shrink-0"
            >
              <Button
                variant="ghost"
                size="sm"
                aria-pressed={active}
                onClick={() => onSelectBoardType(entry.id)}
                className="bd-min-w-0 bd-flex-1 bd-justify-start bd-px-2"
              >
                <TypeIcon type={entry} />
                <span className="bd-min-w-0 bd-flex-1 bd-truncate bd-text-left" title={entry.name}>
                  {entry.name}
                </span>
                <span className="bd-shrink-0 bd-text-xs bd-text-muted-foreground bd-tabular-nums">
                  {count}
                </span>
              </Button>
              <Button
                variant="ghost"
                size="iconSm"
                aria-label={`配置类型：${entry.name}`}
                title={`配置类型：${entry.name}`}
                onClick={() => onOpenSettings({ typeId: entry.id })}
                className="bd-opacity-0 bd-transition-opacity group-hover:bd-opacity-100 group-focus-within:bd-opacity-100 [@media(hover:none)]:bd-opacity-100 [@container(max-width:760px)]:bd-hidden"
              >
                <Icon name="settings" />
              </Button>
            </div>
          );
        })}
      </aside>

      <div className="bd-flex bd-min-h-0 bd-min-w-0 bd-flex-1 bd-flex-col bd-gap-3 bd-p-4 [@container(max-width:640px)]:bd-p-3">
        <div className="bd-flex bd-shrink-0 bd-flex-wrap bd-items-center bd-justify-between bd-gap-2">
          <div className="bd-flex bd-min-w-0 bd-items-center bd-gap-2">
            <TypeIcon type={type} />
            <h1 className="bd-min-w-0 bd-truncate bd-text-lg bd-font-semibold bd-leading-6">
              {type.name}
            </h1>
            <span className="bd-shrink-0 bd-text-xs bd-text-muted-foreground bd-tabular-nums">
              {boardItems.length} 个事项
            </span>
          </div>

          <div className="bd-flex bd-flex-wrap bd-items-center bd-gap-2">
            {pausedOnBoardCount > 0 && (
              <Button
                size="sm"
                variant="ghost"
                aria-pressed={filters.hidePausedOnBoard}
                onClick={() =>
                  onFiltersChange({ hidePausedOnBoard: !filters.hidePausedOnBoard })
                }
              >
                <Icon name="pause" />
                {filters.hidePausedOnBoard ? `显示已暂停 (${pausedOnBoardCount})` : "隐藏已暂停"}
              </Button>
            )}
            {completedOnBoardCount > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  const ok = await confirm({
                    title: "归档已完成事项？",
                    description: `将「${type.name}」看板中已完成的 ${completedOnBoardCount} 个事项移入归档库，阶段与笔记关联保持不变。`,
                    confirmLabel: "归档已完成",
                  });
                  if (!ok) return;
                  await execute(
                    {
                      kind: "items.archiveCompleted",
                      expectedRevision: state.revision,
                      typeId: type.id,
                    },
                    { successMessage: `已归档 ${completedOnBoardCount} 个完成事项` },
                  );
                }}
              >
                <Icon name="archive" />
                归档已完成 ({completedOnBoardCount})
              </Button>
            )}
            <div className="bd-relative bd-flex bd-w-48 bd-max-w-full bd-items-center">
              <span className="bd-pointer-events-none bd-absolute bd-left-2.5 bd-text-muted-foreground">
                <Icon name="search" />
              </span>
              <Input
                type="text"
                role="searchbox"
                aria-label="搜索看板事项"
                placeholder="搜索标题、下一步…"
                value={filters.query}
                onChange={(e) => onFiltersChange({ query: e.target.value })}
                className="bd-h-8 bd-pl-8 bd-text-xs"
              />
            </div>
          </div>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={boardCollision}
          accessibility={{
            container: root,
            restoreFocus: false,
          }}
          onDragStart={({ active }) => {
            const found = boardItems.find((i) => i.id === active.id);
            const rect =
              active.rect.current.initial ??
              root
                .querySelector<HTMLElement>(`[data-item-id="${globalThis.CSS.escape(String(active.id))}"]`)
                ?.getBoundingClientRect();
            if (found && rect) setDragState({ item: found, rect });
          }}
          onDragCancel={() => setDragState(null)}
          onDragEnd={({ active, over }) => {
            setDragState(null);
            if (!over) return;
            const dragged = boardItems.find((i) => i.id === active.id);
            if (!dragged) return;

            const overId = String(over.id);
            let targetStageId: string | undefined;
            let beforeId: string | null = null;
            let afterId: string | null = null;

            if (overId.startsWith("stage:")) {
              targetStageId = overId.slice("stage:".length);
              const stageItems = boardItems.filter(
                (i) => i.stageId === targetStageId && i.id !== dragged.id,
              );
              afterId = stageItems.at(-1)?.id ?? null;
            } else {
              const overItem = boardItems.find((i) => i.id === overId);
              if (!overItem) return;
              targetStageId = overItem.stageId;
              if (overItem.id === dragged.id) return;

              const columnPeers = boardItems.filter((i) => i.stageId === targetStageId);
              const oldIndex = columnPeers.findIndex((i) => i.id === dragged.id);
              const newIndex = columnPeers.findIndex((i) => i.id === overItem.id);
              const withoutDragged = columnPeers.filter((i) => i.id !== dragged.id);
              const targetIdx = withoutDragged.findIndex((i) => i.id === overItem.id);

              if (oldIndex !== -1 && oldIndex < newIndex) {
                afterId = overItem.id;
                beforeId = withoutDragged[targetIdx + 1]?.id ?? null;
              } else {
                beforeId = overItem.id;
                afterId = withoutDragged[targetIdx - 1]?.id ?? null;
              }
            }

            if (!targetStageId || !type.stages.some((s) => s.id === targetStageId)) return;
            const stageChanged = targetStageId !== dragged.stageId;
            const targetStageName = type.stages.find((s) => s.id === targetStageId)?.name ?? "";

            void execute(
              {
                kind: "item.reorder",
                id: dragged.id,
                stageId: targetStageId,
                beforeId,
                afterId,
              },
              {
                successMessage: stageChanged ? `已移至「${targetStageName}」` : undefined,
              },
            );
          }}
        >
          <div
            data-part="collection"
            className="bd-flex bd-min-h-0 bd-min-w-0 bd-flex-1 bd-items-stretch bd-gap-3 bd-overflow-x-auto bd-overflow-y-hidden bd-pb-1"
          >
            {type.stages.map((stage, index) => (
              <StageColumn
                key={stage.id}
                type={type}
                stage={stage}
                index={index}
                total={type.stages.length}
                items={boardItems.filter((i) => i.stageId === stage.id)}
                state={state}
                selectedId={selectedId}
                cardActions={cardActions}
                onRequestDeleteStage={() =>
                  onOpenSettings({ typeId: type.id, deleteStageId: stage.id })
                }
              />
            ))}
            <GhostColumn typeId={type.id} expectedRevision={state.revision} />
          </div>

          {createPortal(
            <div className="bd-pointer-events-none bd-absolute bd-inset-0 bd-z-30">
              <DragOverlay
                dropAnimation={null}
                style={
                  dragState
                    ? {
                        left: dragState.rect.left - rootRect.left,
                        top: dragState.rect.top - rootRect.top,
                        width: dragState.rect.width,
                      }
                    : undefined
                }
              >
                {dragState ? (
                  <div className="bd-pointer-events-none bd-scale-[1.02] bd-opacity-95 motion-reduce:bd-scale-100">
                    <ItemCard
                      state={state}
                      item={dragState.item}
                      selected={false}
                      board
                      overlay
                    />
                  </div>
                ) : null}
              </DragOverlay>
            </div>,
            root,
          )}
        </DndContext>
      </div>
    </div>
  );
}

function StageColumn({
  type,
  stage,
  index,
  total,
  items,
  state,
  selectedId,
  cardActions,
  onRequestDeleteStage,
}: {
  type: ItemType;
  stage: Stage;
  index: number;
  total: number;
  items: Item[];
  state: BuddeState;
  selectedId: string;
  cardActions: ItemCardActions;
  onRequestDeleteStage(): void;
}) {
  const { execute } = useBudde();
  const { setNodeRef, isOver } = useDroppable({
    id: `stage:${stage.id}`,
    data: { stageId: stage.id },
  });

  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(stage.name);
  const composingRef = useRef(false);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renaming) {
      setDraftName(stage.name);
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [renaming, stage.name]);

  const submitRename = async () => {
    const trimmed = draftName.trim();
    if (!trimmed || trimmed === stage.name) {
      setRenaming(false);
      return;
    }
    const res = await execute(
      {
        kind: "stage.update",
        typeId: type.id,
        id: stage.id,
        name: trimmed,
        completed: stage.completed,
        expectedRevision: state.revision,
      },
      { successMessage: "阶段已重命名" },
    );
    if (res.ok) setRenaming(false);
  };

  const isInitial = type.initialStageId === stage.id;

  return (
    <section
      ref={setNodeRef}
      data-stage-id={stage.id}
      aria-label={stage.name}
      className={cn(
        "stage-column bd-group bd-flex bd-h-full bd-w-64 bd-min-w-[256px] bd-shrink-0 bd-flex-col bd-rounded-lg bd-border bd-bg-muted/65 bd-transition-colors",
        isOver ? "bd-border-foreground/35 bd-bg-muted" : "bd-border-border/70",
      )}
    >
      <div className="stage-heading bd-flex bd-shrink-0 bd-items-center bd-gap-2 bd-border-b bd-border-border/50 bd-px-3 bd-py-2.5">
        {stage.completed ? (
          <span className="bd-text-success" title="完成阶段">
            <Icon name="checkCircle" />
          </span>
        ) : (
          <span
            className={cn(
              "bd-h-2 bd-w-2 bd-shrink-0 bd-rounded-full",
              isInitial
                ? "bd-border-2 bd-border-foreground bd-bg-transparent"
                : "bd-bg-muted-foreground/65",
            )}
            title={isInitial ? "初始阶段" : undefined}
          />
        )}

        {renaming ? (
          <Input
            ref={renameInputRef}
            value={draftName}
            maxLength={120}
            aria-label="阶段名称"
            onChange={(e) => setDraftName(e.target.value)}
            onCompositionStart={() => {
              composingRef.current = true;
            }}
            onCompositionEnd={() => {
              composingRef.current = false;
            }}
            onBlur={() => void submitRename()}
            onKeyDown={(e) => {
              if (composingRef.current || e.nativeEvent.isComposing || e.keyCode === 229) return;
              if (e.key === "Enter") {
                e.preventDefault();
                void submitRename();
              } else if (e.key === "Escape") {
                e.preventDefault();
                setRenaming(false);
              }
            }}
            className="bd-h-7 bd-px-2 bd-text-xs"
          />
        ) : (
          <h2
            onDoubleClick={() => setRenaming(true)}
            className="bd-min-w-0 bd-flex-1 bd-truncate bd-text-sm bd-font-medium bd-leading-5"
            title={stage.name}
          >
            {stage.name}
          </h2>
        )}

        <span className="count bd-shrink-0 bd-text-xs bd-text-muted-foreground bd-tabular-nums">
          {items.length}
        </span>
        {stage.completed && (
          <Badge variant="success" className="bd-shrink-0">
            完成
          </Badge>
        )}

        <DropdownMenu
          label={`配置阶段：${stage.name}`}
          trigger={
            <Button
              variant="ghost"
              size="iconSm"
              aria-label={`配置阶段：${stage.name}`}
              className="bd-opacity-0 bd-transition-opacity group-hover:bd-opacity-100 group-focus-within:bd-opacity-100 [@media(hover:none)]:bd-opacity-100"
            >
              <Icon name="more" />
            </Button>
          }
        >
          <DropdownMenuItem onSelect={() => setRenaming(true)}>
            <Icon name="edit" />
            重命名阶段
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={isInitial}
            onSelect={() => {
              void execute(
                {
                  kind: "type.update",
                  id: type.id,
                  name: type.name,
                  initialStageId: stage.id,
                  expectedRevision: state.revision,
                },
                { successMessage: `已将「${stage.name}」设为初始阶段` },
              );
            }}
          >
            <Icon name="circle" />
            {isInitial ? "当前为初始阶段" : "设为初始阶段"}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              void execute(
                {
                  kind: "stage.update",
                  typeId: type.id,
                  id: stage.id,
                  name: stage.name,
                  completed: !stage.completed,
                  expectedRevision: state.revision,
                },
                {
                  successMessage: stage.completed
                    ? "已取消完成阶段标记"
                    : `已将「${stage.name}」标记为完成阶段`,
                },
              );
            }}
          >
            <Icon name="checkCircle" />
            {stage.completed ? "取消完成标记" : "标记为完成阶段"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={index === 0}
            onSelect={() => {
              const ids = type.stages.map((s) => s.id);
              [ids[index], ids[index - 1]] = [ids[index - 1], ids[index]];
              void execute({
                kind: "stage.reorder",
                typeId: type.id,
                ids,
                expectedRevision: state.revision,
              });
            }}
          >
            <Icon name="arrowLeft" />
            向左移动
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={index === total - 1}
            onSelect={() => {
              const ids = type.stages.map((s) => s.id);
              [ids[index], ids[index + 1]] = [ids[index + 1], ids[index]];
              void execute({
                kind: "stage.reorder",
                typeId: type.id,
                ids,
                expectedRevision: state.revision,
              });
            }}
          >
            <Icon name="arrow" />
            向右移动
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            destructive
            disabled={total <= 1}
            onSelect={async () => {
              const allAffected = state.items.filter(
                (i) => i.typeId === type.id && i.stageId === stage.id,
              );
              if (allAffected.length === 0 && !isInitial) {
                await execute(
                  {
                    kind: "stage.delete",
                    typeId: type.id,
                    id: stage.id,
                    expectedRevision: state.revision,
                  },
                  { successMessage: `已删除阶段「${stage.name}」` },
                );
              } else {
                onRequestDeleteStage();
              }
            }}
          >
            <Icon name="trash" />
            删除阶段…
          </DropdownMenuItem>
        </DropdownMenu>
      </div>

      <SortableContext
        items={items.map((i) => i.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="stage-items bd-flex bd-min-h-0 bd-flex-1 bd-flex-col bd-gap-2 bd-overflow-y-auto bd-p-2.5">
          {items.length > 0 ? (
            items.map((item) => (
              <SortableBoardCard
                key={item.id}
                state={state}
                item={item}
                selected={selectedId === item.id}
                actions={cardActions}
              />
            ))
          ) : (
            <div className="bd-flex bd-flex-1 bd-items-center bd-justify-center bd-py-8 bd-text-center bd-text-xs bd-text-muted-foreground">
              拖入事项或从想法池推进
            </div>
          )}
        </div>
      </SortableContext>
    </section>
  );
}

function SortableBoardCard({
  state,
  item,
  selected,
  actions,
}: {
  state: BuddeState;
  item: Item;
  selected: boolean;
  actions: ItemCardActions;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    data: { stageId: item.stageId },
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <ItemCard
      state={state}
      item={item}
      selected={selected}
      board
      actions={actions}
      dragRef={setNodeRef}
      dragStyle={style}
      dragAttributes={attributes}
      dragListeners={listeners}
      isDragging={isDragging}
    />
  );
}

function GhostColumn({
  typeId,
  expectedRevision,
}: {
  typeId: string;
  expectedRevision: number;
}) {
  const { execute } = useBudde();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [completed, setCompleted] = useState(false);
  const [busy, setBusy] = useState(false);
  const composingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  return (
    <section
      data-ghost-column
      aria-label="新增阶段"
      className={cn(
        "bd-shrink-0 bd-self-start bd-rounded-lg bd-border bd-border-dashed bd-border-border bd-bg-background/50",
        open ? "bd-w-64 bd-min-w-[256px] bd-p-3" : "bd-w-36 bd-min-w-[144px] bd-p-1.5",
      )}
    >
      {open ? (
        <form
          className="bd-space-y-2.5"
          onSubmit={async (e) => {
            e.preventDefault();
            if (composingRef.current || busy || !name.trim()) return;
            setBusy(true);
            const res = await execute(
              {
                kind: "stage.add",
                typeId,
                name: name.trim(),
                completed,
                expectedRevision,
              },
              { successMessage: `已新增阶段「${name.trim()}」` },
            );
            setBusy(false);
            if (res.ok) {
              setName("");
              setCompleted(false);
              setOpen(false);
            }
          }}
        >
          <Input
            ref={inputRef}
            aria-label="新阶段名称"
            placeholder="输入阶段名称…"
            maxLength={120}
            value={name}
            disabled={busy}
            onChange={(e) => setName(e.target.value)}
            onCompositionStart={() => {
              composingRef.current = true;
            }}
            onCompositionEnd={() => {
              composingRef.current = false;
            }}
            onKeyDown={(e) => {
              if (composingRef.current || e.nativeEvent.isComposing || e.keyCode === 229) return;
              if (e.key === "Escape") {
                e.preventDefault();
                setName("");
                setOpen(false);
              }
            }}
          />
          <label className="bd-flex bd-items-center bd-gap-2 bd-text-xs bd-text-muted-foreground">
            <input
              type="checkbox"
              checked={completed}
              onChange={(e) => setCompleted(e.target.checked)}
              className="bd-h-3.5 bd-w-3.5 bd-accent-primary"
            />
            标记为完成阶段
          </label>
          <div className="bd-flex bd-gap-2">
            <Button size="sm" type="submit" disabled={busy || !name.trim()}>
              {busy ? "创建中…" : "添加阶段"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setName("");
                setOpen(false);
              }}
            >
              取消
            </Button>
          </div>
        </form>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="bd-w-full bd-justify-start"
          onClick={() => setOpen(true)}
        >
          <Icon name="plus" />
          新增阶段列
        </Button>
      )}
    </section>
  );
}
