import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { DndContext, DragOverlay, pointerWithin, rectIntersection, useDroppable, type CollisionDetection, type DragStartEvent, type KeyboardCoordinateGetter } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import type { BuddeState, Item, Stage } from "../core/types";
import { TypeIcon } from "./type-presentation";
import { Input } from "./components/ui/fields";
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

interface CollectionProps { state: BuddeState; view: View; filters: Filters; selected: string; onMove(id: string, stageId: string): void | Promise<void>; onAddStage(name: string): Promise<void> }
export function CollectionView({ state, view, filters, selected, onMove, onAddStage }: CollectionProps) {
  const items = selectItems(state, view, filters);
  if (view === 'board') return <Board key={filters.typeId} state={state} items={items} typeId={filters.typeId} selected={selected} onMove={onMove} onAddStage={onAddStage} />;
  if (!items.length) return <div className="empty-state bd-mx-auto bd-flex bd-h-full bd-max-w-md bd-flex-col bd-items-center bd-justify-center bd-gap-3 bd-p-6 bd-text-center">
    <span className="bd-text-muted-foreground"><Icon name={view === 'archive' ? 'archive' : view === 'active' ? 'active' : 'pool'} /></span>
    <h2 className="bd-text-base bd-font-medium">{filters.query || filters.typeId || filters.unpromotedOnly ? '没有匹配的事项' : view === 'pool' ? '先留下一个标题' : view === 'archive' ? '还没有归档事项' : '准备好时，再开始推进'}</h2>
    <p className="bd-text-sm bd-leading-6 bd-text-muted-foreground">{view === 'pool' ? '不需要日期，也不需要先建一篇笔记。' : '记录和推进是两回事，想做时再展开。'}</p>
    {filters.query || filters.typeId || filters.unpromotedOnly ? <Button variant="outline" data-action="clear-filters"><Icon name="search" />清除筛选</Button> : <Button variant="outline" data-action="focus-capture"><Icon name="plus" />记录一个想法</Button>}
  </div>;
  return <div className="bd-grid bd-grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] bd-items-start bd-gap-2.5">{items.map(item => <ItemCard key={item.id} state={state} item={item} selected={item.id === selected} />)}</div>;
}
function Board({ state, items, typeId, selected, onMove, onAddStage }: { state: BuddeState; items: Item[]; typeId: string; selected: string; onMove(id: string, stageId: string): void | Promise<void>; onAddStage(name: string): Promise<void> }) {
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
    <div className="bd-flex bd-min-h-full bd-min-w-full bd-items-stretch bd-gap-3">{type.stages.map((stage, index) => <StageColumn key={stage.id} stage={stage} index={index} items={items.filter(i => i.stageId === stage.id)} state={state} selected={selected} typeId={typeId} total={type.stages.length} />)}<GhostColumn onAddStage={onAddStage} /></div>
    {createPortal(<div className="bd-pointer-events-none bd-absolute bd-inset-0 bd-z-20 bd-transform"><DragOverlay dropAnimation={null} style={drag ? { left: drag.rect.left - rootRect.left, top: drag.rect.top - rootRect.top } : undefined}>{drag ? <div data-drag-overlay aria-hidden="true" className="bd-pointer-events-none bd-opacity-95 bd-scale-[1.02] motion-reduce:bd-scale-100"><ItemCard state={state} item={drag.item} selected={false} overlay /></div> : null}</DragOverlay></div>, root)}
  </DndContext>;
}
function GhostColumn({ onAddStage }: { onAddStage(name: string): Promise<void> }) {
  const [open, setOpen] = useState(false), [name, setName] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const composing = useRef(false), saving = useRef(false), alive = useRef(true), focusAfter = useRef(false);
  const input = useRef<HTMLInputElement>(null), button = useRef<HTMLButtonElement>(null), section = useRef<HTMLElement>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { if (focusAfter.current && !busy) { focusAfter.current = false; (open ? input.current : button.current)?.focus({ preventScroll: true }); } }, [open, busy]);
  const cancel = () => { if (saving.current) return; composing.current = false; setError(''); setName(''); focusAfter.current = true; setOpen(false); };
  return <section ref={section} data-ghost-column aria-label="新增阶段" className="bd-w-60 bd-min-w-[240px] bd-shrink-0 bd-self-start bd-rounded-lg bd-border bd-border-dashed bd-border-border bd-bg-background/50 bd-p-3">
    {open ? <form aria-busy={busy} className="bd-space-y-3" onSubmit={async event => {
      event.preventDefault(); if (composing.current || saving.current) return;
      if (!name.trim()) { setError('请先输入阶段名称。'); input.current?.focus(); return; }
      saving.current = true; setBusy(true); setError('');
      try { await onAddStage(name); if (alive.current) { setName(''); setOpen(false); } }
      catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : String(cause)); }
      finally { saving.current = false; if (alive.current) { const document = section.current!.ownerDocument; focusAfter.current = document.activeElement === document.body || !!section.current?.contains(document.activeElement); setBusy(false); } }
    }}><Input ref={input} aria-label="新阶段名称" placeholder="新阶段名称" maxLength={120} value={name} disabled={busy} onChange={event => setName(event.target.value)} onCompositionStart={() => composing.current = true} onCompositionEnd={() => composing.current = false} onKeyDown={event => { if (event.key === 'Enter' && (composing.current || event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault(); if (event.key === 'Escape' && !composing.current && !event.nativeEvent.isComposing && event.keyCode !== 229) { event.preventDefault(); event.stopPropagation(); cancel(); } }} />
      <p className="bd-text-xs bd-leading-5 bd-text-muted-foreground">Enter 创建 · Esc 取消</p>
      {error && <p role="alert" className="bd-break-words bd-text-xs bd-leading-5">{error} 请重试；若版本已变化，请从更多操作重新读取。</p>}
      <div className="bd-flex bd-flex-wrap bd-gap-2"><Button type="submit" variant="outline" disabled={busy}>{busy ? '正在创建…' : '创建阶段'}</Button><Button variant="ghost" disabled={busy} onClick={cancel}>取消</Button></div>
    </form> : <Button ref={button} variant="ghost" className="bd-w-full bd-justify-start" onClick={() => { focusAfter.current = true; setOpen(true); }}><Icon name="plus" />新增阶段</Button>}
  </section>;
}
function StageColumn({ stage, index, items, state, selected, typeId, total }: { stage: Stage; index: number; items: Item[]; state: BuddeState; selected: string; typeId: string; total: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: `stage:${stage.id}`, data: { stageId: stage.id } });
  return <section ref={setNodeRef} data-stage-id={stage.id} data-drag-over={isOver || undefined} aria-label={stage.name} className={cn('stage-column bd-group bd-min-h-full bd-min-w-[240px] bd-flex-1 bd-rounded-lg bd-border bd-border-transparent bd-bg-muted/70 bd-p-3', isOver && 'bd-border-border')}>
    <div className="stage-heading bd-mb-3 bd-flex bd-min-w-0 bd-items-center bd-gap-2 bd-px-0.5"><span className="bd-shrink-0 bd-text-muted-foreground"><Icon name={stage.completed ? 'check' : index === 0 ? 'circle' : index === 1 ? 'target' : 'build'} /></span><h2 className="bd-min-w-0 bd-flex-1 bd-truncate bd-text-sm bd-font-medium bd-leading-5" title={stage.name}>{stage.name}</h2><span className="count bd-shrink-0 bd-text-xs bd-leading-4 bd-text-muted-foreground bd-tabular-nums">{items.length}</span>{stage.completed && <Badge className="bd-shrink-0">完成</Badge>}<DropdownMenu label={`配置阶段：${stage.name}`} className="stage-settings-menu bd-opacity-0 bd-transition-opacity bd-duration-150 bd-ease-out group-hover:bd-opacity-100 group-focus-within:bd-opacity-100 [@media(hover:none)]:bd-opacity-100">
      <DropdownMenuItem><Button variant="ghost" className={menuItemClass} data-action="stage.settings" data-type-id={typeId} data-stage-id={stage.id}><Icon name="edit" />重命名阶段</Button></DropdownMenuItem>
      <DropdownMenuItem><Button variant="ghost" className={menuItemClass} data-stage-command="toggle" data-type-id={typeId} data-stage-id={stage.id}><Icon name="check" />{stage.completed ? '取消完成标记' : '标记为完成阶段'}</Button></DropdownMenuItem>
      <DropdownMenuItem><Button variant="ghost" className={menuItemClass} data-stage-command="left" data-type-id={typeId} data-stage-id={stage.id} disabled={index === 0}><span className="bd-rotate-180"><Icon name="arrow" /></span>向左移动</Button></DropdownMenuItem>
      <DropdownMenuItem><Button variant="ghost" className={menuItemClass} data-stage-command="right" data-type-id={typeId} data-stage-id={stage.id} disabled={index === total - 1}><Icon name="arrow" />向右移动</Button></DropdownMenuItem>
      <DropdownMenuItem><Button variant="ghost" className={menuItemClass} data-action="stage.settings" data-operation="delete" data-type-id={typeId} data-stage-id={stage.id} disabled={total === 1}><Icon name="close" />删除并迁移</Button></DropdownMenuItem>
    </DropdownMenu></div>
    <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}><div className="stage-items bd-flex bd-min-h-20 bd-flex-col bd-gap-2.5">{items.length ? items.map(item => <SortableCard key={item.id} state={state} item={item} selected={selected === item.id} />) : <p className="column-empty bd-py-5 bd-text-center bd-text-xs bd-leading-4 bd-text-muted-foreground">暂无事项</p>}</div></SortableContext>
  </section>;
}
function SortableCard({ state, item, selected }: { state: BuddeState; item: Item; selected: boolean }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, data: { stageId: item.stageId }, animateLayoutChanges: () => false });
  const style: CSSProperties = { transform: CSS.Transform.toString(transform), transition };
  return <div ref={setNodeRef} style={style} data-drag-placeholder={isDragging || undefined} className="bd-min-w-0 bd-rounded-lg bd-border bd-border-transparent data-[drag-placeholder=true]:bd-border-dashed data-[drag-placeholder=true]:bd-border-border data-[drag-placeholder=true]:[&>.item-card]:bd-opacity-0"><ItemCard state={state} item={item} selected={selected} board dragHandle={<Tooltip label="拖动调整阶段；也可按空格与方向键"><Button ref={setActivatorNodeRef} variant="ghost" size="icon" data-drag-handle aria-label={`拖动事项：${item.title}`} {...attributes} {...listeners} className="bd-touch-none bd-cursor-grab active:bd-cursor-grabbing"><Icon name="grip" /></Button></Tooltip>} /></div>;
}
function ItemCard({ state, item, selected, board = false, overlay = false, dragHandle }: { state: BuddeState; item: Item; selected: boolean; board?: boolean; overlay?: boolean; dragHandle?: ReactNode }) {
  const type = state.types.find(t => t.id === item.typeId)!; const stage = type.stages.find(s => s.id === item.stageId)!;
  const status = item.paused ? '已暂停' : !item.promoted ? '未推进' : isCompleted(state, item) ? '已完成' : '';
  return <motion.article layout="position" transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }} className={cn('item-card bd-group/card bd-min-w-0 bd-rounded-lg bd-border bd-border-border bd-bg-card bd-p-3.5 bd-text-foreground', overlay ? 'bd-shadow-lift' : 'bd-shadow-xs', selected && 'selected bd-bg-background')} data-item-id={overlay ? undefined : item.id}>
    <button type="button" className="card-open bd-flex bd-w-full bd-min-w-0 bd-flex-col bd-gap-2 bd-rounded-sm bd-text-left focus-visible:bd-outline-none focus-visible:bd-ring-2 focus-visible:bd-ring-ring" data-open={overlay ? undefined : item.id} aria-label={item.title} tabIndex={overlay ? -1 : undefined}>
      <span className="card-title bd-block bd-w-full bd-min-w-0 bd-truncate bd-text-sm bd-font-medium bd-leading-5" title={item.title}>{item.title}</span>
      {!board && <span className="card-meta bd-flex bd-max-w-full bd-items-center bd-gap-1 bd-text-xs bd-leading-4 bd-text-muted-foreground"><TypeIcon type={type} /><span className="bd-min-w-0 bd-truncate">{type.name} · {stage.name}</span></span>}
      {status && <span className="card-meta bd-flex bd-items-center bd-gap-1 bd-text-xs bd-leading-4 bd-text-muted-foreground"><span className="bd-h-1 bd-w-1 bd-rounded-full bd-bg-muted-foreground" />{status}</span>}
      {needsReview(state, item) && <span className="review-mark bd-flex bd-items-center bd-gap-1 bd-text-xs bd-text-muted-foreground"><Icon name="clock" />需复查</span>}
      {(item.nextStep || item.description) && <span className="card-note bd-line-clamp-2 bd-w-full bd-break-words bd-text-xs bd-leading-5 bd-text-muted-foreground">{item.nextStep || item.description}</span>}
      {!!item.links.length && <span className="card-meta bd-flex bd-items-center bd-gap-1 bd-text-xs bd-leading-4 bd-text-muted-foreground bd-tabular-nums"><Icon name="link" />{item.links.length} 条关联笔记</span>}
    </button>
    {!overlay && ((!item.promoted && !item.archived) || board) && <div className="card-actions bd-mt-2 bd-flex bd-items-center bd-justify-between bd-gap-2 bd-opacity-0 bd-transition-opacity bd-duration-150 bd-ease-out group-hover/card:bd-opacity-100 group-focus-within/card:bd-opacity-100 [@media(hover:none)]:bd-opacity-100">
      {!item.promoted && !item.archived && <Button variant="ghost" data-promote={item.id} className="bd-px-0"><Icon name="active" />开始推进</Button>}
      {board && <><span className="bd-flex-1">{dragHandle}</span><DropdownMenu label={`更改阶段：${item.title}`} className="card-menu">{type.stages.map((entry, index) => <DropdownMenuItem key={entry.id}><Button variant="ghost" className={menuItemClass} data-stage-item={item.id} data-stage-target={entry.id} disabled={entry.id === item.stageId}><Icon name={entry.completed ? 'check' : index === 0 ? 'circle' : index === 1 ? 'target' : 'build'} /><span className="bd-min-w-0 bd-truncate">{entry.name}</span></Button></DropdownMenuItem>)}</DropdownMenu></>}
    </div>}
  </motion.article>;
}
