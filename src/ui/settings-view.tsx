import type { BuddeState } from "../core/types";
import { usePart } from "./react-renderer";
import { Icon } from "./components/icons";
import { Button } from "./components/ui/button";
import { FieldHelp, Input, Label, NativeSelect } from "./components/ui/fields";
import { DialogTitle } from "./components/ui/dialog";
import type { Editor } from "./settings";

export function SettingsView({ state, active, editor }: { state: BuddeState; active: string; editor?: Editor }) {
  const part = usePart(); const type = state.types.find(t => t.id === active)!;
  return <div className="bd-space-y-6" style={{ containerType: 'inline-size' }}>
    <div className="settings-header bd-flex bd-flex-wrap bd-items-start bd-justify-between bd-gap-3"><div className="bd-min-w-0 bd-space-y-1"><DialogTitle>管理类型与阶段</DialogTitle><p className="bd-text-xs bd-leading-5 bd-text-muted-foreground bd-tabular-nums">载入版本 {state.revision} · <span {...part('settings-status')} role="status" aria-live="polite" /></p></div><div className="bd-flex bd-gap-2"><Button variant="outline" data-settings-action="reload">重新读取设置</Button><Button variant="ghost" size="icon" data-settings-action="close" aria-label="关闭设置"><Icon name="close" /></Button></div></div>
    <fieldset {...part('settings-controls')} className="settings-body bd-grid bd-min-w-0 bd-grid-cols-[144px_minmax(0,1fr)] bd-gap-6 [@container(max-width:600px)]:bd-grid-cols-1">
      <aside className="settings-types bd-flex bd-min-w-0 bd-flex-col bd-gap-1 [@container(max-width:600px)]:bd-flex-row [@container(max-width:600px)]:bd-overflow-x-auto" aria-label="类型列表">{state.types.map(t => <Button key={t.id} variant="ghost" data-settings-type={t.id} aria-pressed={t.id === active} className="bd-justify-start"><span className="bd-min-w-0 bd-truncate" title={t.name}>{t.name}</span></Button>)}<Button variant="outline" data-settings-action="type.create" className="new-type bd-mt-3 [@container(max-width:600px)]:bd-mt-0"><Icon name="plus" />新建类型</Button></aside>
      <section className="settings-content bd-min-w-0 bd-space-y-4">
        <div className="settings-type-heading bd-flex bd-flex-wrap bd-items-center bd-gap-2"><h3 className="bd-min-w-0 bd-flex-1 bd-truncate bd-text-sm bd-font-medium" title={type.name}>{type.name}</h3><Button variant="outline" data-settings-action="type.update">编辑类型</Button><Button variant="ghost" data-settings-action="type.delete">删除类型</Button></div>
        <FieldHelp>初始阶段控制新建落点；完成标记与排列位置无关。</FieldHelp>
        <ol className="stage-list bd-divide-y bd-divide-border bd-rounded-md bd-border bd-border-border">{type.stages.map((stage, index) => <li key={stage.id} data-stage-row={stage.id} className="bd-flex bd-flex-wrap bd-items-center bd-gap-2 bd-p-3"><div className="stage-description bd-min-w-28 bd-flex-1"><span className="bd-block bd-truncate bd-text-sm bd-font-medium" title={stage.name}>{stage.name}</span><small className="bd-block bd-text-xs bd-leading-5 bd-text-muted-foreground">{stage.id === type.initialStageId ? '初始阶段' : ''}{stage.id === type.initialStageId && stage.completed ? ' · ' : ''}{stage.completed ? '完成阶段' : ''}</small></div><div className="stage-controls bd-flex bd-flex-wrap bd-gap-1"><Button variant="ghost" size="icon" data-settings-action="up" data-id={stage.id} aria-label={`上移阶段：${stage.name}`} disabled={index === 0}><Icon name="up" /></Button><Button variant="ghost" size="icon" data-settings-action="down" data-id={stage.id} aria-label={`下移阶段：${stage.name}`} disabled={index === type.stages.length - 1}><Icon name="down" /></Button><Button variant="ghost" data-settings-action="stage.update" data-id={stage.id}>编辑</Button><Button variant="ghost" data-settings-action="stage.delete" data-id={stage.id} disabled={type.stages.length === 1}>删除</Button></div></li>)}</ol>
        <Button variant="outline" data-settings-action="stage.add"><Icon name="plus" />新增阶段</Button><div {...part('settings-editor')}><SettingsEditor state={state} active={active} editor={editor} /></div><div {...part('settings-error')} role="alert" hidden className="bd-break-words bd-rounded-md bd-border bd-border-border bd-p-3 bd-text-sm bd-leading-6" />
      </section>
    </fieldset>
  </div>;
}
function SettingsEditor({ state, active, editor }: { state: BuddeState; active: string; editor?: Editor }) {
  const part = usePart();
  if (!editor) return <p className="settings-idle bd-text-xs bd-leading-5 bd-text-muted-foreground">选择一个设置项编辑。每次只提交当前表单，避免把其他输入一并保存。</p>;
  const type = state.types.find(t => t.id === active)!; const values = editor.values;
  const deleting = editor.kind.endsWith('delete'); const typeOperation = editor.kind.startsWith('type.');
  const label = ({ 'type.create': '新建类型', 'type.update': '编辑类型', 'type.delete': '删除类型', 'stage.add': '新增阶段', 'stage.update': '编辑阶段', 'stage.delete': '删除阶段' })[editor.kind];
  const stage = type.stages.find(s => s.id === editor.id);
  const affected = state.items.filter(item => item.typeId === type.id && (typeOperation || item.stageId === editor.id));
  const archived = affected.filter(item => item.archived).length;
  const blocked = editor.kind === 'type.delete' && (affected.length > 0 || state.types.length === 1);
  return <form {...part('settings-form')} noValidate className="bd-space-y-3 bd-rounded-md bd-border bd-border-border bd-bg-background bd-p-4"><h3 className="bd-break-words bd-text-sm bd-font-medium">{label}{stage ? ` · ${stage.name}` : ''}</h3>
    {!deleting && <div className="bd-space-y-2"><Label htmlFor={part('setting-name').id}>{typeOperation ? '类型名称' : '阶段名称'}</Label><Input {...part('setting-name')} data-editor-field="name" defaultValue={values.name} autoComplete="off" /></div>}
    {editor.kind === 'type.update' && <div className="bd-space-y-2"><Label htmlFor={part('setting-initial').id}>初始阶段</Label><NativeSelect {...part('setting-initial')} data-editor-field="initialStageId" defaultValue={values.initialStageId}>{type.stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</NativeSelect><FieldHelp>仅改变之后新建事项的落点，不移动已有事项。</FieldHelp></div>}
    {editor.kind === 'stage.update' && <><Label className="bd-flex bd-items-center bd-gap-2"><input type="checkbox" data-editor-field="completed" defaultChecked={values.completed} className="bd-h-4 bd-w-4 bd-accent-primary" />完成阶段</Label><FieldHelp>完成由此标记决定，与阶段顺序无关。改变标记会改变该阶段事项的集合归属。</FieldHelp></>}
    {deleting && <p {...part('migration-impact')} className="bd-text-sm bd-leading-6 bd-text-muted-foreground bd-tabular-nums">涉及 {affected.length} 个事项，其中 {archived} 个归档。{typeOperation ? affected.length ? '类型仍被引用，不能删除；请先在事项详情迁移所有引用。' : state.types.length === 1 ? '至少保留一种类型。' : '此类型未被引用，可以删除。' : `${type.initialStageId === editor.id ? '这也是初始阶段，删除时初始落点一并切换。' : ''}迁移包含归档事项；相关事项的版本会更新，暂停与归档状态保持不变。`}</p>}
    {editor.kind === 'stage.delete' && <div className="bd-space-y-2"><Label htmlFor={part('setting-target').id}>迁移目标阶段</Label><NativeSelect {...part('setting-target')} data-editor-field="targetId" defaultValue={values.targetId}><option value="">请选择迁移目标</option>{type.stages.filter(s => s.id !== editor.id).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</NativeSelect></div>}
    <div className="setting-form-actions bd-flex bd-flex-wrap bd-gap-2"><Button type="submit" disabled={blocked}>{deleting ? typeOperation ? '确认删除类型' : '确认删除并迁移' : '保存设置'}</Button><Button variant="outline" data-settings-action="cancel-editor">取消编辑</Button></div>
  </form>;
}
