import { useState } from "react";
import { Shapes, FileText, NotebookPen, BookOpen, PenLine, Code2, Terminal, Bug, Wrench, Lightbulb, FlaskConical, Rocket, Target, Flag, CheckCircle2, Circle, Folder, Briefcase, CalendarDays, Clock3, Plane, Map, Compass, Mountain, Camera, Music2, Film, Palette, Heart, Dumbbell, GraduationCap, Coffee, Home, ShoppingBag, Gamepad2, Leaf } from "lucide-react";
import type { ItemType } from "../core/types";
import { TYPE_ICONS, TYPE_COLORS, isTypeIcon, type TypeColor, type TypeLucideIcon } from "../core/type-config";
import { Button } from "./components/ui/button";
import { Input, Label, FieldHelp } from "./components/ui/fields";
import { usePart } from "./react-renderer";

const icons = { Shapes, FileText, NotebookPen, BookOpen, PenLine, Code2, Terminal, Bug, Wrench, Lightbulb, FlaskConical, Rocket, Target, Flag, CheckCircle2, Circle, Folder, Briefcase, CalendarDays, Clock3, Plane, Map, Compass, Mountain, Camera, Music2, Film, Palette, Heart, Dumbbell, GraduationCap, Coffee, Home, ShoppingBag, Gamepad2, Leaf };
const colorNames: Record<TypeColor, string> = { default: "中性", blue: "雾蓝", emerald: "青绿", amber: "暖琥珀", violet: "浅紫", rose: "柔玫瑰" };
const tint = (color?: string) => color && color !== "default" ? `rgb(var(--bd-type-${color}))` : undefined;

/** Legacy presentation defaults live here only: reading never rewrites data. */
export function TypeIcon({ type }: { type: Pick<ItemType, "icon" | "color"> }) {
  const value = type.icon || "Shapes";
  const Component = Object.hasOwn(icons, value) ? icons[value as TypeLucideIcon] : undefined;
  return <span data-type-icon data-color={type.color || "default"} aria-hidden="true" className="bd-inline-flex bd-h-4 bd-w-4 bd-shrink-0 bd-items-center bd-justify-center bd-text-base bd-leading-none" style={{ color: tint(type.color) }}>{Component ? <Component size={16} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" focusable="false" /> : value}</span>;
}

export function TypePicker({ name, icon: initialIcon, color: initialColor, onChange }: { name: string; icon: string; color: string; onChange(patch: { icon?: string; color?: string }): void }) {
  const part = usePart();
  const [tab, setTab] = useState<"icons" | "emoji">("icons"), [query, setQuery] = useState("");
  const [icon, setIcon] = useState(initialIcon), [color, setColor] = useState(initialColor);
  const [emoji, setEmoji] = useState(initialIcon && !Object.hasOwn(icons, initialIcon) ? initialIcon : "");
  const [error, setError] = useState("");
  const pick = (patch: { icon?: string; color?: string }) => { if (patch.icon !== undefined) setIcon(patch.icon); if (patch.color !== undefined) setColor(patch.color); onChange(patch); setError(""); };
  const matches = TYPE_ICONS.filter(entry => `${entry.name} ${entry.label} ${entry.keywords}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <section data-type-picker className="bd-min-w-0 bd-space-y-3" aria-label="类型外观">
    <div data-type-preview data-color={color || "default"} className="bd-flex bd-min-h-12 bd-min-w-0 bd-items-center bd-gap-3 bd-rounded-md bd-border bd-border-border bd-bg-card bd-p-3"><TypeIcon type={{ icon: icon || undefined, color: color ? color as TypeColor : undefined }} /><span className="bd-min-w-0 bd-break-words bd-text-sm bd-font-medium">{name || "类型预览"}</span></div>
    <div role="tablist" aria-label="图标来源" className="bd-flex bd-gap-1">{([['icons', '线性图标'], ['emoji', 'Emoji']] as const).map(([value, label]) => <Button key={value} variant="ghost" role="tab" id={part(`picker-tab-${value}`).id} aria-selected={tab === value} aria-controls={part('picker-panel').id} aria-pressed={tab === value} onClick={() => setTab(value)} onKeyDown={event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'Home' || event.key === 'End') { event.preventDefault(); const next = event.key === 'Home' ? 'icons' : event.key === 'End' ? 'emoji' : tab === 'icons' ? 'emoji' : 'icons'; setTab(next); document.getElementById(part(`picker-tab-${next}`).id)?.focus(); } }} tabIndex={tab === value ? 0 : -1}>{label}</Button>)}</div>
    <div {...part('picker-panel')} role="tabpanel" aria-labelledby={part(`picker-tab-${tab}`).id} className="bd-space-y-3">
      {tab === 'icons' ? <><Input type="search" aria-label="搜索图标" placeholder="搜索图标，如：旅行、阅读、代码" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') event.preventDefault(); }} /><div className="bd-grid bd-grid-cols-[repeat(auto-fill,minmax(36px,1fr))] bd-gap-1">{matches.map(entry => <Button key={entry.name} variant="ghost" size="icon" data-icon-option={entry.name} aria-label={entry.label} title={entry.label} aria-pressed={(icon || 'Shapes') === entry.name} onClick={() => pick({ icon: entry.name })}><TypeIcon type={{ icon: entry.name, color: color ? color as TypeColor : undefined }} /></Button>)}</div>{!matches.length && <FieldHelp>没有匹配的图标，试试「学习」「计划」或「生活」。</FieldHelp>}</> : <div className="bd-space-y-2"><Label htmlFor={part('picker-emoji').id}>单个 Emoji</Label><div className="bd-flex bd-flex-wrap bd-gap-2"><Input {...part('picker-emoji')} aria-label="单个 Emoji" value={emoji} maxLength={64} onChange={event => setEmoji(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') event.preventDefault(); }} className="bd-min-w-0 bd-flex-1" /><Button variant="outline" onClick={() => { if (!isTypeIcon(emoji) || Object.hasOwn(icons, emoji)) { setError('请输入一个 Emoji；支持肤色、家庭和旗帜组合。'); return; } pick({ icon: emoji }); }}>使用 Emoji</Button></div><FieldHelp>使用系统 Emoji 输入面板；无需联网。</FieldHelp></div>}
    </div>
    {error && <p role="alert" className="bd-text-xs bd-leading-5">{error}</p>}
    <fieldset className="bd-min-w-0 bd-space-y-2"><legend className="bd-text-control bd-font-medium">柔和配色</legend><div className="bd-flex bd-flex-wrap bd-gap-2">{TYPE_COLORS.map(value => <Button key={value} variant="outline" size="icon" aria-label={colorNames[value]} title={colorNames[value]} data-color-option={value} aria-pressed={(color || 'default') === value} onClick={() => pick({ color: value })}><span className="bd-h-4 bd-w-4 bd-rounded-full bd-bg-current" style={{ color: tint(value) || 'rgb(var(--bd-muted-foreground))' }} /></Button>)}</div></fieldset>
    <Button variant="ghost" onClick={() => pick({ icon: '', color: '' })}>恢复中性外观</Button>
  </section>;
}
