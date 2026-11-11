import { Archive, ArrowRight, CheckCircle2, ChevronDown, ChevronUp, Circle, Clock3, Code2, ExternalLink, FileText, GripVertical, Inbox, Kanban, Link, MoreHorizontal, Pause, Pencil, Plane, Plus, Search, Shapes, SlidersHorizontal, Target, Wrench, X, Zap, type LucideIcon } from "lucide-react";
import { BUDDE_MARK } from "../../brand";
import type { IconName } from "../dom";
const icons: Record<Exclude<IconName, "brand">, LucideIcon> = { pool: Inbox, board: Kanban, active: Zap, archive: Archive, more: MoreHorizontal, plus: Plus, up: ChevronUp, down: ChevronDown, note: FileText, code: Code2, plane: Plane, shapes: Shapes, settings: SlidersHorizontal, search: Search, circle: Circle, target: Target, build: Wrench, check: CheckCircle2, pause: Pause, clock: Clock3, link: Link, edit: Pencil, close: X, arrow: ArrowRight, open: ExternalLink, grip: GripVertical };
export function Icon({ name }: { name: IconName }) {
  if (name === "brand") return <svg data-icon={name} width={24} height={24} viewBox={BUDDE_MARK.viewBox} fill="none" stroke="currentColor" strokeWidth={BUDDE_MARK.strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" className="bd-shrink-0"><path d={BUDDE_MARK.path} /></svg>;
  const Component = icons[name];
  return <Component data-icon={name} size={16} strokeWidth={1.75} aria-hidden="true" focusable="false" className="bd-shrink-0" />;
}
