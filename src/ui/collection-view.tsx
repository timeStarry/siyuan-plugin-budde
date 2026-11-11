import { useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { DndContext, DragOverlay, pointerWithin, rectIntersection, useDroppable, type CollisionDetection, type DragStartEvent, type KeyboardCoordinateGetter } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import type { BuddeState, Item, Stage } from "../core/types";
import { typeIcon } from "./dom";
import { isCompleted, needsReview, selectItems, type Filters, type View } from "./model";
import { usePane } from "./react-renderer";
import { cn } from "./lib/utils";
import { useOwnedSensors } from "./lib/owned-sensors";

const stageCollision: CollisionDetection = args => {
  const columns = { ...args, droppableContainers: args.droppableContainers.filter(entry => String(entry.id).startsWith('stage:')) };
  // Stage movement, not a fictitious persisted card rank. Keyboard rectangles
  // and pointer hit targets must both include an empty adjacent column.
  return args.pointerCoordinates ? pointerWithin(columns) : rectIntersection(columns);
};
import { Icon } from "./components/icons";
import { Button } from "./components/ui/button";
import { Badge } from "./components/ui/badge";
import { DropdownMenu, DropdownMenuItem, menuItemClass } from "./components/ui/dropdown-menu";
import { Tooltip } from "./components/ui/tooltip";

interface CollectionProps { state: BuddeState; view: View; filters: Filters; selected: string; onMove(id: string, stageId: string): void | Promise<void> }
export function CollectionView({ state, view, filters, selected, onMove }: CollectionProps) {
  const items = selectItems(state, view, filters);
  if (view === 'board') return <Board state={state} items={items} typeId={filters.typeId} selected={selected} onMove={onMove} />;
  if (!items.length) return <div className="empty-state bd-mx-auto bd-flex bd-h-full bd-max-w-md bd-flex-col bd-items-center bd-justify-center bd-gap-3 bd-p-6 bd-text-center">
    <span className="bd-text-muted-foreground"><Icon name={view === 'archive' ? 'archive' : view === 'active' ? 'active' : 'pool'} /></span>
    <h2 className="bd-text-base bd-font-medium">{filters.query || filters.typeId || filters.unpromotedOnly ? '没有匹配的事项' : view === 'pool' ? '先留下一个标题' : view === 'archive' ? '还没有归档事项' : '准备好时，再开始推进'}</h2>
    <p className="bd-text-sm bd-leading-6 bd-text-muted-foreground">{view === 'pool' ? '不需要日期，也不需要先建一篇笔记。' : '记录和推进是两回事，想做时再展开。'}</p>
    {filters.query || filters.typeId || filters.unpromotedOnly ? <Button variant="outline" data-action="clear-filters"><Icon name="search" />清除筛选</Button> : <Button variant="outline" data-action="focus-capture"><Icon name="plus" />记录一个想法</Button>}
  </div>;
  return <div className="bd-grid bd-grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] bd-items-start bd-gap-2.5">{items.map(item => <ItemCard key={item.id} state={state} item={item} selected={item.id === selected} />)}</div>;
}
function Board({ state, items, typeId, selected, onMove }: { state: BuddeState; items: Item[]; typeId: string; selected: string; onMove(id: string, stageId: string): void | Promise<void> }) {
  const { root } = usePane(); const type = state.types.find(t => t.id === typeId)!;
  const [drag, setDrag] = useState<{ item: Item; rect: NonNullable<DragStartEvent['active']['rect']['current']['initial']> } | null>(null);
  const keyboard: KeyboardCoordinateGetter = (event, args) => {
    if (event.code !== 'ArrowRight' && event.code !== 'ArrowLeft') return sortableKeyboardCoordinates(event, args);
    const current = args.context.over?.data.current?.stageId ?? args.context.active?.data.current?.stageId;
    const index = type.stages.findIndex(stage => stage.id === current) + (event.code === 'ArrowRight' ? 1 : -1);
    const stage = type.stages[index]; if (!stage) return;
    const column = root.querySelector<HTMLElement>(`[data-stage-id="${globalThis.CSS.escape(stage.id)}"]`);
    if (!column) return;
    event.preventDefault();
    const viewport = root.querySelector<HTMLElement>('[data-part="collection"]')!;
    const bounds = viewport.getBoundingClientRect(), target = column.getBoundingClientRect();
    viewport.scrollLeft += target.left < bounds.left ? target.left - bounds.left : target.right > bounds.right ? target.right - bounds.right : 0;
    const rect = column.querySelector('.stage-items')!.getBoundingClientRect(); return { x: rect.left, y: rect.top };
  };
  const sensors = useOwnedSensors(root, keyboard);
  const rootRect = root.getBoundingClientRect();
  return <DndContext sensors={sensors} collisionDetection={stageCollision} autoScroll={{ canScroll: element => element === root.querySelector('[data-part="collection"]') }} accessibility={{ container: root, restoreFocus: false, screenReaderInstructions: { draggable: '按空格拾起事项，左右方向键切换阶段，上下方向键定位，空格放下，Escape 取消。列内顺序不单独保存。' }, announcements: {
    onDragStart: () => '已拾起事项。左右方向键切换阶段，空格放下，Escape 取消。',
    onDragOver: ({ over }) => over ? `目标阶段：${type.stages.find(s => s.id === over.data.current?.stageId)?.name ?? ''}` : '移出看板，可取消移动。',
    onDragEnd: () => '拖动结束，阶段变更以保存结果为准。', onDragCancel: () => '已取消拖动，事项没有改变。',
  } }} onDragStart={({ active }) => { const item = items.find(i => i.id === active.id); const rect = active.rect.current.initial ?? root.querySelector<HTMLElement>(`[data-item-id="${globalThis.CSS.escape(String(active.id))}"]`)?.getBoundingClientRect(); if (item && rect) setDrag({ item, rect }); }} onDragCancel={() => setDrag(null)} onDragEnd={({ active, over, activatorEvent }) => {
    setDrag(null); const item = items.find(i => i.id === active.id); const stageId = over?.data.current?.stageId as string | undefined;
    if (item && stageId && stageId !== item.stageId && type.stages.some(s => s.id === stageId)) {
      void Promise.resolve(onMove(item.id, stageId)).then(() => {
        // Restore a moved keyboard card only after the command has reconciled
        // its new column. Never reclaim another control/instance/dialog's focus.
        const document = root.ownerDocument;
        if (activatorEvent instanceof KeyboardEvent && root.isConnected && !root.querySelector('dialog[open]') && (document.activeElement === document.body || document.activeElement === activatorEvent.target)) root.querySelector<HTMLElement>(`[data-item-id="${globalThis.CSS.escape(item.id)}"] [data-drag-handle]`)?.focus({ preventScroll: true });
      });
    }
  }}>
    <div className="bd-flex bd-min-h-full bd-min-w-full bd-items-stretch bd-gap-3">{type.stages.map((stage, index) => <StageColumn key={stage.id} stage={stage} index={index} items={items.filter(i => i.stageId === stage.id)} state={state} selected={selected} />)}</div>
    {createPortal(<div className="bd-pointer-events-none bd-absolute bd-inset-0 bd-z-20 bd-transform"><DragOverlay dropAnimation={null} style={drag ? { left: drag.rect.left - rootRect.left, top: drag.rect.top - rootRect.top } : undefined}>{drag ? <div data-drag-overlay aria-hidden="true" className="bd-pointer-events-none bd-opacity-70"><ItemCard state={state} item={drag.item} selected={false} overlay /></div> : null}</DragOverlay></div>, root)}
  </DndContext>;
}
function StageColumn({ stage, index, items, state, selected }: { stage: Stage; index: number; items: Item[]; state: BuddeState; selected: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: `stage:${stage.id}`, data: { stageId: stage.id } });
  return <section ref={setNodeRef} data-stage-id={stage.id} data-drag-over={isOver || undefined} aria-label={stage.name} className={cn('stage-column bd-min-h-full bd-min-w-[240px] bd-flex-1 bd-rounded-lg bd-border bd-border-transparent bd-bg-muted/70 bd-p-3', isOver && 'bd-border-border')}>
    <div className="stage-heading bd-mb-3 bd-flex bd-min-w-0 bd-items-center bd-gap-2 bd-px-0.5"><span className="bd-shrink-0 bd-text-muted-foreground"><Icon name={stage.completed ? 'check' : index === 0 ? 'circle' : index === 1 ? 'target' : 'build'} /></span><h2 className="bd-min-w-0 bd-flex-1 bd-truncate bd-text-sm bd-font-medium bd-leading-5" title={stage.name}>{stage.name}</h2><span className="count bd-shrink-0 bd-text-xs bd-leading-4 bd-text-muted-foreground bd-tabular-nums">{items.length}</span>{stage.completed && <Badge className="bd-shrink-0">完成</Badge>}</div>
    <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}><div className="stage-items bd-flex bd-min-h-20 bd-flex-col bd-gap-2.5">{items.length ? items.map(item => <SortableCard key={item.id} state={state} item={item} selected={selected === item.id} />) : <p className="column-empty bd-py-5 bd-text-center bd-text-xs bd-leading-4 bd-text-muted-foreground">暂无事项</p>}</div></SortableContext>
  </section>;
}
function SortableCard({ state, item, selected }: { state: BuddeState; item: Item; selected: boolean }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, data: { stageId: item.stageId }, animateLayoutChanges: () => false });
  const style: CSSProperties = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.3 : 1 };
  return <div ref={setNodeRef} style={style} className="bd-min-w-0"><ItemCard state={state} item={item} selected={selected} board dragHandle={<Tooltip label="拖动调整阶段；也可按空格与方向键"><Button ref={setActivatorNodeRef} variant="ghost" size="icon" data-drag-handle aria-label={`拖动事项：${item.title}`} {...attributes} {...listeners} className="bd-touch-none bd-cursor-grab active:bd-cursor-grabbing"><Icon name="grip" /></Button></Tooltip>} /></div>;
}
function ItemCard({ state, item, selected, board = false, overlay = false, dragHandle }: { state: BuddeState; item: Item; selected: boolean; board?: boolean; overlay?: boolean; dragHandle?: ReactNode }) {
  const type = state.types.find(t => t.id === item.typeId)!; const stage = type.stages.find(s => s.id === item.stageId)!;
  const status = item.paused ? '已暂停' : !item.promoted ? '未推进' : isCompleted(state, item) ? '已完成' : '';
  return <motion.article layout="position" transition={{ duration: 0.2 }} className={cn('item-card bd-min-w-0 bd-rounded-lg bd-border bd-border-border bd-bg-card bd-p-3.5 bd-text-foreground bd-shadow-xs', selected && 'selected bd-bg-background')} data-item-id={overlay ? undefined : item.id}>
    <button type="button" className="card-open bd-flex bd-w-full bd-min-w-0 bd-flex-col bd-gap-2 bd-rounded-sm bd-text-left focus-visible:bd-outline-none focus-visible:bd-ring-2 focus-visible:bd-ring-ring" data-open={overlay ? undefined : item.id} aria-label={item.title} tabIndex={overlay ? -1 : undefined}>
      <span className="card-title bd-block bd-w-full bd-min-w-0 bd-truncate bd-text-sm bd-font-medium bd-leading-5" title={item.title}>{item.title}</span>
      {!board && <span className="card-meta bd-flex bd-max-w-full bd-items-center bd-gap-1 bd-text-xs bd-leading-4 bd-text-muted-foreground"><Icon name={typeIcon(type.name)} /><span className="bd-min-w-0 bd-truncate">{type.name} · {stage.name}</span></span>}
      {status && <span className="card-meta bd-flex bd-items-center bd-gap-1 bd-text-xs bd-leading-4 bd-text-muted-foreground"><span className="bd-h-1 bd-w-1 bd-rounded-full bd-bg-muted-foreground" />{status}</span>}
      {needsReview(state, item) && <span className="review-mark bd-flex bd-items-center bd-gap-1 bd-text-xs bd-text-muted-foreground"><Icon name="clock" />需复查</span>}
      {(item.nextStep || item.description) && <span className="card-note bd-line-clamp-2 bd-w-full bd-break-words bd-text-xs bd-leading-5 bd-text-muted-foreground">{item.nextStep || item.description}</span>}
      {!!item.links.length && <span className="card-meta bd-flex bd-items-center bd-gap-1 bd-text-xs bd-leading-4 bd-text-muted-foreground bd-tabular-nums"><Icon name="link" />{item.links.length} 条关联笔记</span>}
    </button>
    {!overlay && ((!item.promoted && !item.archived) || board) && <div className="card-actions bd-mt-2 bd-flex bd-items-center bd-justify-between bd-gap-2">
      {!item.promoted && !item.archived && <Button variant="ghost" data-promote={item.id} className="bd-px-0"><Icon name="active" />开始推进</Button>}
      {board && <><span className="bd-flex-1">{dragHandle}</span><DropdownMenu label={`更改阶段：${item.title}`} className="card-menu">{type.stages.map((entry, index) => <DropdownMenuItem key={entry.id}><Button variant="ghost" className={menuItemClass} data-stage-item={item.id} data-stage-target={entry.id} disabled={entry.id === item.stageId}><Icon name={entry.completed ? 'check' : index === 0 ? 'circle' : index === 1 ? 'target' : 'build'} /><span className="bd-min-w-0 bd-truncate">{entry.name}</span></Button></DropdownMenuItem>)}</DropdownMenu></>}
    </div>}
  </motion.article>;
}
