import {
  AlertCircle,
  Archive,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Circle,
  Clock3,
  Code2,
  Download,
  ExternalLink,
  FilePlus2,
  FileText,
  Flag,
  GripVertical,
  Inbox,
  Kanban,
  LayoutGrid,
  Link,
  List,
  ListChecks,
  MoreHorizontal,
  Pause,
  Pencil,
  Pin,
  Plane,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Shapes,
  SlidersHorizontal,
  Trash2,
  Upload,
  Wrench,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { BUDDE_MARK } from "../../brand";

const icons = {
  pool: Inbox,
  board: Kanban,
  active: Zap,
  archive: Archive,
  more: MoreHorizontal,
  plus: Plus,
  up: ChevronUp,
  down: ChevronDown,
  right: ChevronRight,
  note: FileText,
  noteAdd: FilePlus2,
  code: Code2,
  plane: Plane,
  shapes: Shapes,
  settings: SlidersHorizontal,
  search: Search,
  circle: Circle,
  build: Wrench,
  check: Check,
  checkCircle: CheckCircle2,
  pause: Pause,
  play: Play,
  clock: Clock3,
  link: Link,
  edit: Pencil,
  close: X,
  arrow: ArrowRight,
  arrowLeft: ArrowLeft,
  open: ExternalLink,
  grip: GripVertical,
  pin: Pin,
  trash: Trash2,
  upload: Upload,
  download: Download,
  refresh: RefreshCw,
  undo: RotateCcw,
  alert: AlertCircle,
  grid: LayoutGrid,
  list: List,
  sortAsc: ArrowUp,
  sortDesc: ArrowDown,
  flag: Flag,
  checklist: ListChecks,
} satisfies Record<string, LucideIcon>;

export type IconName = "brand" | keyof typeof icons;

const OUTLINE_SVG_STYLE = { fill: "none", stroke: "currentColor" } as const;

export function Icon({ name, className = "" }: { name: IconName; className?: string }) {
  if (name === "brand") {
    return (
      <svg
        data-icon={name}
        width={24}
        height={24}
        viewBox={BUDDE_MARK.viewBox}
        fill="none"
        stroke="currentColor"
        strokeWidth={BUDDE_MARK.strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={OUTLINE_SVG_STYLE}
        aria-hidden="true"
        focusable="false"
        className={`bd-shrink-0 ${className}`.trim()}
      >
        <path d={BUDDE_MARK.path} fill="none" style={{ fill: "none" }} />
      </svg>
    );
  }
  const Component = icons[name];
  return (
    <Component
      data-icon={name}
      size={16}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={OUTLINE_SVG_STYLE}
      aria-hidden="true"
      focusable="false"
      className={`bd-shrink-0 ${className}`.trim()}
    />
  );
}
