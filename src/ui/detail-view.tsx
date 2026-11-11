import { useRef, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { BuddeState, Item } from "../core/types";
import { isCompleted, needsReview } from "./model";
import { typeIcon } from "./dom";
import { usePart, usePane } from "./react-renderer";
import { Icon } from "./components/icons";
import { Button } from "./components/ui/button";
import { Input, Label, NativeSelect, Textarea, FieldHelp } from "./components/ui/fields";
import { Badge } from "./components/ui/badge";
import { Tooltip } from "./components/ui/tooltip";

/** The width animates while content ownership changes synchronously. No exiting
 * interactive copy can intercept a new item's controller queries or focus. */
export function DetailFrame({ open, children }: { open: boolean; children?: ReactNode }) {
  const reduced = useReducedMotion(); const ref = useRef<HTMLDivElement>(null);
  return <motion.div ref={ref} initial={false} animate={{ width: open ? 420 : 0, opacity: open ? 1 : 0 }} transition={{ duration: reduced ? 0 : 0.2 }} onAnimationStart={() => { if (ref.current) ref.current.dataset.motionBusy = 'true'; }} onAnimationComplete={() => { if (ref.current) ref.current.dataset.motionBusy = 'false'; }} className="detail-frame bd-h-full bd-max-w-full bd-overflow-hidden bd-bg-card">{children}</motion.div>;
}
export function DetailView({ state, item, editing }: { state: BuddeState; item: Item; editing: boolean }) {
  const part = usePart(); const type = state.types.find(t => t.id === item.typeId)!;
  const noteList = <ul {...part('note-links')} className="bd-flex bd-flex-col bd-gap-2" />;
  return <section className="detail-pane bd-flex bd-h-full bd-w-full bd-min-w-0 bd-flex-col bd-border-l bd-border-border bd-bg-card" tabIndex={-1} aria-label="事项详情">
    <div className="detail-heading bd-flex bd-min-h-16 bd-shrink-0 bd-items-center bd-gap-2 bd-border-b bd-border-border bd-px-6 bd-py-3"><span className="detail-heading-label bd-flex bd-min-w-0 bd-flex-1 bd-items-center bd-gap-2 bd-text-sm bd-font-medium"><Icon name="note" />事项详情<span {...part('detail-status')} className="bd-sr-only" role="status" aria-live="polite" /></span>{!editing && <Button data-detail-action="edit" aria-label="编辑事项"><Icon name="edit" />编辑</Button>}<Tooltip label="关闭详情"><Button variant="ghost" size="icon" data-detail-action="close" aria-label="关闭详情"><Icon name="close" /></Button></Tooltip></div>
    <p {...part('selected-hidden')} className="bd-border-b bd-border-border bd-px-6 bd-py-3 bd-text-xs bd-leading-5 bd-text-muted-foreground" hidden>此事项不在当前结果中，详情与草稿仍保留。</p>
    <div className="detail-body bd-min-h-0 bd-min-w-0 bd-flex-1 bd-overflow-y-auto bd-overscroll-contain bd-p-6">
      {editing ? <form {...part('detail-form')} noValidate><fieldset className="bd-min-w-0 bd-space-y-4">
        <div className="bd-space-y-2"><Label htmlFor={part('detail-title').id}>事项标题</Label><Input {...part('detail-title')} maxLength={500} defaultValue={item.title} autoComplete="off" /></div>
        <div className="detail-selects bd-grid bd-grid-cols-2 bd-gap-3"><div className="bd-min-w-0 bd-space-y-2"><Label htmlFor={part('detail-type').id}>事项类型</Label><NativeSelect {...part('detail-type')} defaultValue={item.typeId}>{state.types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</NativeSelect></div><div className="bd-min-w-0 bd-space-y-2"><Label htmlFor={part('detail-stage').id}>事项阶段</Label><NativeSelect {...part('detail-stage')} defaultValue={item.stageId}><StageOptions state={state} typeId={item.typeId} /></NativeSelect></div></div>
        <div className="bd-space-y-2"><Label htmlFor={part('detail-next').id}>下一步</Label><Textarea {...part('detail-next')} rows={3} defaultValue={item.nextStep} /></div>
        <div className="bd-space-y-2"><Label htmlFor={part('detail-description').id}>简短说明</Label><Textarea {...part('detail-description')} rows={4} defaultValue={item.description} /></div>
        <section className="notes-section bd-space-y-3"><SectionTitle>思源笔记</SectionTitle>{noteList}<Button variant="outline" data-detail-action="link"><Icon name="plus" />关联笔记</Button><div {...part('link-editor')} className="bd-space-y-3" hidden><Label htmlFor={part('note-target').id}>笔记目标</Label><Input {...part('note-target')} placeholder="已有块 ID、思源链接或块引用" /><div className="link-add-row bd-flex bd-gap-2"><NativeSelect {...part('note-role')} aria-label="关联角色" defaultValue="reference"><option value="reference">资料</option><option value="outcome">成果</option></NativeSelect><Button variant="outline" data-detail-action="add-link">添加关联</Button></div><FieldHelp>仅关联已有笔记；移除关联不删除正文。</FieldHelp></div></section>
        <div className="save-row bd-flex bd-flex-wrap bd-gap-2"><Button {...part('detail-save')} type="submit">保存更改</Button><Button variant="outline" data-detail-action="cancel-edit">取消编辑</Button></div>
      </fieldset></form> : <div className="detail-read bd-space-y-6">
        <div className="bd-space-y-3"><h2 className="bd-break-words bd-text-xl bd-font-semibold bd-leading-7">{item.title}</h2><div className="detail-meta item-context bd-flex bd-flex-wrap bd-gap-2"><Badge className="type-label"><Icon name={typeIcon(type.name)} /><span className="bd-min-w-0 bd-truncate">{type.name}</span></Badge><Badge className="status-label"><Icon name={item.archived ? 'archive' : item.paused ? 'pause' : !item.promoted ? 'circle' : isCompleted(state, item) ? 'check' : 'active'} />{item.archived ? '已归档' : item.paused ? '已暂停' : !item.promoted ? '未开始推进' : isCompleted(state, item) ? '已完成' : '正在推进'}</Badge>{needsReview(state, item) && <Badge className="review-status"><Icon name="clock" />需复查</Badge>}</div></div>
        <StagePath state={state} item={item} />
        <section className="next-section bd-space-y-3"><SectionTitle>下一步</SectionTitle><div className="next-step bd-flex bd-items-start bd-gap-2 bd-rounded-md bd-border bd-border-border bd-bg-background bd-p-3"><span className="bd-mt-1 bd-text-muted-foreground"><Icon name="arrow" /></span><p className={`read-content bd-min-w-0 bd-whitespace-pre-wrap bd-break-words bd-text-sm bd-leading-6 ${item.nextStep ? '' : 'bd-text-muted-foreground'}`}>{item.nextStep || '还没有下一步，留白也没关系。'}</p></div></section>
        <section className="bd-space-y-3"><SectionTitle>简短说明</SectionTitle><p className={`read-content bd-whitespace-pre-wrap bd-break-words bd-text-sm bd-leading-6 ${item.description ? '' : 'bd-text-muted-foreground'}`}>{item.description || '需要时再补充背景。'}</p></section>
        <section className="notes-section bd-space-y-3"><SectionTitle>思源笔记</SectionTitle>{noteList}</section>
      </div>}
      <div {...part('detail-error')} role="alert" hidden className="bd-mt-4 bd-break-words bd-rounded-md bd-border bd-border-border bd-p-3 bd-text-sm bd-leading-6" /><Button variant="outline" data-detail-action="reload" hidden className="bd-mt-3 bd-max-w-full bd-whitespace-normal bd-text-left">放弃草稿并读取最新版本</Button>
    </div>
    <div className="detail-footer bd-flex bd-shrink-0 bd-flex-wrap bd-items-center bd-gap-2 bd-border-t bd-border-border bd-px-4 bd-py-3">
      {!item.promoted ? <Button variant="ghost" data-detail-action="promote"><Icon name="active" />开始推进</Button> : <Button variant="ghost" data-detail-action="pause"><Icon name={item.paused ? 'active' : 'pause'} />{item.paused ? '恢复推进' : '暂停推进'}</Button>}
      {item.promoted && !item.archived && !isCompleted(state, item) && <Button variant="ghost" data-detail-action="review"><Icon name="check" />标记已复查</Button>}
      <Tooltip label={item.archived ? '移出归档' : '归档事项'}><Button variant="ghost" size="icon" className="archive-action bd-ml-auto" data-detail-action="archive" aria-label={item.archived ? '移出归档' : '归档事项'}><Icon name="archive" /></Button></Tooltip>
    </div>
  </section>;
}
function SectionTitle({ children }: { children: ReactNode }) { return <h3 className="bd-text-sm bd-font-medium bd-leading-5">{children}</h3>; }
export function StageOptions({ state, typeId }: { state: BuddeState; typeId: string }) { return <><option value="">请选择目标阶段</option>{state.types.find(t => t.id === typeId)!.stages.map(stage => <option key={stage.id} value={stage.id}>{stage.name}</option>)}</>; }
export function NoteLinks({ item, editing }: { item: Item; editing: boolean }) { return item.links.length ? <>{item.links.map(link => <li key={link.id} className="bd-flex bd-min-w-0 bd-items-center bd-gap-2"><Button variant="ghost" data-note-open={link.id} className="note-link bd-h-auto bd-min-w-0 bd-flex-1 bd-justify-start bd-whitespace-normal bd-px-0 bd-py-2"><Icon name="note" /><span className="note-text bd-min-w-0 bd-flex-1 bd-text-left"><span className="note-name bd-block bd-truncate">{link.title}</span><span className="note-role bd-block bd-text-xs bd-font-normal bd-text-muted-foreground">{link.role === 'reference' ? '资料' : '成果'}</span></span><Icon name="open" /></Button>{editing && <Button variant="ghost" size="icon" data-remove-link={link.id} aria-label={`移除关联：${link.title}`}><Icon name="close" /></Button>}</li>)}</> : <li className="bd-text-xs bd-leading-5 bd-text-muted-foreground">还没有关联笔记。</li>; }
export function StagePath({ state, item }: { state: BuddeState; item: Item }) {
  const type = state.types.find(t => t.id === item.typeId)!; const { prefix } = usePane();
  return <section className="stage-path bd-min-w-0 bd-space-y-3" aria-label="阶段路径与当前位置"><div className="bd-flex bd-items-center bd-justify-between bd-gap-3"><SectionTitle>阶段路径</SectionTitle><span className="position bd-shrink-0 bd-text-xs bd-text-muted-foreground bd-tabular-nums">位置 {type.stages.findIndex(s => s.id === item.stageId) + 1} / {type.stages.length}</span></div>
    <ol tabIndex={0} aria-label="可横向滚动的阶段路径" className="bd-flex bd-min-w-0 bd-overflow-x-auto bd-overscroll-x-contain bd-rounded-sm bd-pb-2 focus-visible:bd-outline-none focus-visible:bd-ring-2 focus-visible:bd-ring-ring">{type.stages.map(stage => <li key={stage.id} aria-current={stage.id === item.stageId ? 'step' : undefined} className="bd-relative bd-flex bd-min-w-24 bd-flex-1 bd-flex-col bd-items-start bd-gap-2 bd-pr-4">
      <span className="bd-relative bd-flex bd-h-4 bd-w-full bd-items-center"><span className="bd-absolute bd-left-2 bd-right-0 bd-h-px bd-bg-border" /><span className="path-point bd-relative bd-h-2 bd-w-2 bd-rounded-full bd-border bd-border-border bd-bg-card">{stage.id === item.stageId && <motion.span layoutId={`${prefix}-${item.id}-current-stage`} transition={{ duration: 0.2 }} className="bd-absolute -bd-inset-px bd-rounded-full bd-bg-primary" />}</span></span>
      <span className="path-label bd-max-w-full bd-truncate bd-text-xs bd-leading-4" title={stage.name}>{stage.name}</span><small className="path-caption bd-whitespace-nowrap bd-text-xs bd-leading-4 bd-text-muted-foreground">{stage.id === item.stageId ? '当前位置' : ''}{stage.completed ? `${stage.id === item.stageId ? ' · ' : ''}完成阶段` : ''}</small>
    </li>)}</ol><p className="bd-sr-only">阶段顺序不是执行历史，也不代表完成比例。</p></section>;
}
