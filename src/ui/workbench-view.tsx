import type { BuddeState } from "../core/types";
import { TypeIcon } from "./type-presentation";
import { selectItems, type Filters } from "./model";
import { usePart, usePane } from "./react-renderer";
import { motion, useReducedMotion } from "framer-motion";
import type { View } from "./model";
import { Icon } from "./components/icons";
import { Button } from "./components/ui/button";
import { Input, NativeSelect } from "./components/ui/fields";
import { Badge } from "./components/ui/badge";
import { Dialog, dialogLayer } from "./components/ui/dialog";
import { DropdownMenu, DropdownMenuItem, menuItemClass } from "./components/ui/dropdown-menu";

export function WorkbenchView() {
  const part = usePart();
  return <>
    <header className="app-header bd-flex bd-min-h-16 bd-shrink-0 bd-items-center bd-gap-6 bd-border-b bd-border-border bd-bg-card bd-px-6 bd-py-3 [@container(max-width:640px)]:bd-flex-wrap [@container(max-width:640px)]:bd-gap-2 [@container(max-width:640px)]:bd-px-3">
      <div className="brand bd-flex bd-w-36 bd-shrink-0 bd-items-center bd-gap-2 bd-text-lg bd-font-semibold"><Icon name="brand" /><span data-brand-wordmark className="bd-font-brand bd-font-semibold bd-tracking-normal bd-whitespace-nowrap [font-synthesis:none]">Budde</span></div>
      <nav {...part('main-nav')} className="main-nav bd-flex bd-min-w-0 bd-gap-1 [@container(max-width:640px)]:bd-order-3 [@container(max-width:640px)]:bd-w-full [@container(max-width:640px)]:bd-overflow-x-auto" aria-label="主视图" />
      <div className="header-secondary bd-ml-auto bd-flex bd-items-center bd-gap-1">
        <Button variant="ghost" data-view="archive" aria-pressed={false}><Icon name="archive" />归档</Button>
        <DropdownMenu label="更多操作" className="more"><DropdownMenuItem><Button variant="ghost" className={menuItemClass} data-action="export"><Icon name="note" />导出 JSON</Button></DropdownMenuItem><DropdownMenuItem><Button variant="ghost" className={menuItemClass} data-action="refresh"><Icon name="circle" />重新读取</Button></DropdownMenuItem></DropdownMenu>
      </div>
    </header>
    <section className="capture-area bd-shrink-0 bd-border-b bd-border-border bd-bg-card bd-px-6 bd-py-4 [@container(max-width:640px)]:bd-px-3" aria-label="快速记录">
      <form {...part('capture')} noValidate className="bd-grid bd-grid-cols-[16px_minmax(0,1fr)_auto_auto] bd-items-center bd-gap-3 bd-rounded-lg bd-border bd-border-border bd-bg-background bd-p-3 [@container(max-width:640px)]:bd-grid-cols-[16px_minmax(0,1fr)_auto]">
        <span className="bd-text-muted-foreground"><Icon name="plus" /></span>
        <Input {...part('capture-title')} maxLength={500} aria-label="想法标题" placeholder="记下一个想法，标题就够了" autoComplete="off" disabled className="bd-border-transparent bd-bg-transparent bd-px-0" />
        <div className="capture-type bd-flex bd-min-w-0 bd-items-center bd-gap-2 [@container(max-width:640px)]:bd-col-start-2 [@container(max-width:640px)]:bd-row-start-2">
          <span className="bd-shrink-0 bd-text-xs bd-text-muted-foreground [@container(max-width:800px)]:bd-hidden">新事项类型</span><NativeSelect {...part('create-type')} aria-label="新事项类型" disabled className="bd-w-32 [@container(max-width:640px)]:bd-w-full" />
        </div>
        <Button type="submit" disabled className="[@container(max-width:640px)]:bd-col-start-3 [@container(max-width:640px)]:bd-row-span-2 [@container(max-width:640px)]:bd-row-start-1">记下来<kbd data-capture-hint aria-hidden="true" className="bd-rounded-sm bd-border bd-border-primary-foreground/25 bd-px-1 bd-text-xs bd-font-normal bd-opacity-80 [@container(max-width:640px)]:bd-sr-only">Enter</kbd></Button>
      </form>
      <div className="capture-feedback bd-mt-2 bd-text-xs bd-leading-4 bd-text-muted-foreground"><div {...part('notice')} role="status" aria-live="polite">正在读取工作空间数据…</div><div {...part('error')} role="alert" hidden /></div>
    </section>
    <main className="workspace bd-relative bd-flex bd-min-h-0 bd-min-w-0 bd-flex-1 bd-overflow-hidden">
      <section className="main-panel bd-flex bd-min-h-0 bd-min-w-0 bd-flex-1 [@container(max-width:800px)]:bd-flex-col" aria-label="事项工作区">
        <aside {...part('type-index')} aria-label="看板类型" hidden className="bd-w-44 bd-shrink-0 bd-overflow-y-auto bd-border-r bd-border-border bd-bg-muted/70 bd-p-3 [@container(max-width:800px)]:bd-w-full [@container(max-width:800px)]:bd-overflow-y-hidden [@container(max-width:800px)]:bd-border-b [@container(max-width:800px)]:bd-border-r-0" />
        <div className="board-main bd-flex bd-min-h-0 bd-min-w-0 bd-flex-1 bd-flex-col bd-gap-4 bd-p-6 [@container(max-width:640px)]:bd-p-3">
          <div className="view-toolbar bd-flex bd-flex-wrap bd-items-center bd-justify-between bd-gap-3">
            <div className="view-heading bd-flex bd-min-w-0 bd-items-baseline bd-gap-3"><h1 className="bd-min-w-0 bd-truncate bd-text-xl bd-font-semibold bd-leading-7">想法池</h1><span {...part('result-count')} className="bd-shrink-0 bd-whitespace-nowrap bd-text-xs bd-text-muted-foreground bd-tabular-nums" /></div>
            <div className="filters bd-flex bd-max-w-full bd-flex-wrap bd-gap-2"><span className="search-field bd-relative bd-flex bd-w-48 bd-max-w-full bd-items-center"><span className="bd-pointer-events-none bd-absolute bd-left-3 bd-text-muted-foreground"><Icon name="search" /></span><Input type="search" {...part('title-search')} aria-label="搜索事项标题" placeholder="搜索事项标题" className="bd-pl-9" /></span><NativeSelect {...part('filter-type')} aria-label="筛选类型" className="bd-w-32" /></div>
          </div>
          <div {...part('pool-modes')} className="pool-modes bd-flex bd-gap-1"><Button variant="ghost" data-pool="all" aria-pressed={false}>全部</Button><Button variant="ghost" data-pool="unpromoted" aria-pressed={false}>未开始推进</Button></div>
          <div className="collection-frame bd-min-h-0 bd-min-w-0 bd-flex-1 bd-overflow-hidden"><div {...part('collection')} tabIndex={-1} aria-label="事项列表" className="bd-h-full bd-min-w-0 bd-overflow-auto bd-p-0.5" /></div>
          <p {...part('board-hint')} className="board-hint bd-flex bd-shrink-0 bd-items-center bd-gap-2 bd-text-xs bd-leading-4 bd-text-muted-foreground" hidden><Icon name="grip" />拖动手柄调整阶段，也可以在详情中修改；列内顺序不单独保存</p>
        </div>
      </section>
      <div {...part('detail-host')} className="bd-min-h-0 bd-max-w-full bd-shrink-0 data-[overlay=true]:bd-absolute data-[overlay=true]:bd-inset-0 data-[overlay=true]:bd-z-20 data-[overlay=true]:bd-flex data-[overlay=true]:bd-justify-end data-[overlay=true]:bd-bg-scrim/10" />
    </main>
    <div {...part('success-hud')} hidden role="status" aria-live="polite" aria-atomic="true" className="success-hud bd-pointer-events-none bd-absolute bd-bottom-6 bd-left-1/2 bd-z-40 bd-flex bd-max-w-[calc(100%-24px)] -bd-translate-x-1/2 bd-items-center bd-gap-2 bd-rounded-lg bd-border bd-border-border bd-bg-card/85 bd-px-4 bd-py-3 bd-text-control bd-text-foreground bd-shadow-xs bd-backdrop-blur-[12px]"><Icon name="check" /><span {...part('success-message')} className="bd-min-w-0 bd-break-words" /></div>
    <div className={`dialog-layer settings-layer ${dialogLayer} [&:not(:has(dialog[open]))]:bd-hidden`}><Dialog {...part('settings-dialog')} aria-label="管理类型与阶段" /></div>
  </>;
}
export function MainNavView({ view }: { view: View }) {
  const { prefix } = usePane(); const reduced = useReducedMotion();
  return <>{([['pool', '想法池'], ['board', '看板'], ['active', '正在推进']] as const).map(([target, label]) => <Button key={target} variant="ghost" data-view={target} aria-pressed={target === view} className="bd-relative bd-isolate aria-pressed:bd-bg-transparent">
    {target === view && <motion.span data-nav-indicator layoutId={`${prefix}-main-nav`} className="bd-pointer-events-none bd-absolute bd-inset-0 -bd-z-10 bd-rounded-md bd-border bd-border-border bd-bg-muted bd-shadow-xs" transition={{ duration: reduced ? 0 : 0.18, ease: [0.22, 1, 0.36, 1] }} />}
    <Icon name={target} />{label}
  </Button>)}</>;
}
export function TypeOptions({ state, all = false }: { state: BuddeState; all?: boolean }) { return <>{all && <option value="">所有类型</option>}{state.types.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}</>; }
export function TypeIndexView({ state, boardType, filters }: { state: BuddeState; boardType: string; filters: Filters }) {
  return <div className="bd-flex bd-flex-col bd-gap-1 [@container(max-width:800px)]:bd-flex-row [@container(max-width:800px)]:bd-overflow-x-auto">
    <div className="bd-flex bd-shrink-0 bd-items-center bd-justify-between bd-gap-1 bd-pl-3"><span className="bd-text-xs bd-text-muted-foreground [@container(max-width:800px)]:bd-sr-only">按类型查看</span><Button variant="ghost" size="icon" data-action="type.create" aria-label="新建类型"><Icon name="plus" /></Button></div>
    {state.types.map(type => <div key={type.id} data-type-row={type.id} className="bd-group bd-flex bd-min-w-0 bd-items-center bd-gap-0.5 [@container(max-width:800px)]:bd-w-48 [@container(max-width:800px)]:bd-shrink-0"><Button variant="ghost" data-board-type={type.id} data-type={type.id} aria-pressed={type.id === boardType} className="bd-min-w-0 bd-flex-1 bd-justify-start bd-px-2"><TypeIcon type={type} /><span className="type-name bd-min-w-0 bd-flex-1 bd-truncate bd-text-left" title={type.name}>{type.name}</span><Badge className="count bd-shrink-0 bd-border-transparent bd-bg-transparent bd-p-0">{selectItems(state, 'board', { ...filters, typeId: type.id }).length}</Badge></Button><Button variant="ghost" size="icon" data-action="type.settings" data-type-id={type.id} aria-label={`配置类型：${type.name}`} className="bd-opacity-0 bd-transition-opacity bd-duration-150 bd-ease-out group-hover:bd-opacity-100 group-focus-within:bd-opacity-100 [@media(hover:none)]:bd-opacity-100"><Icon name="edit" /></Button></div>)}
  </div>;
}
