import { useId, useState, type CSSProperties } from "react";
import {
  Shapes,
  FileText,
  NotebookPen,
  BookOpen,
  PenLine,
  Code2,
  Terminal,
  Bug,
  Wrench,
  Lightbulb,
  FlaskConical,
  Rocket,
  Target,
  Flag,
  CheckCircle2,
  Circle,
  Folder,
  Briefcase,
  CalendarDays,
  Clock3,
  Plane,
  Map,
  Compass,
  Mountain,
  Camera,
  Music2,
  Film,
  Palette,
  Heart,
  Dumbbell,
  GraduationCap,
  Coffee,
  Home,
  ShoppingBag,
  Gamepad2,
  Leaf,
} from "lucide-react";
import type { ItemPriority, ItemType } from "../core/types";
import {
  PRIORITY_LABELS,
  TYPE_ICONS,
  TYPE_COLORS,
  isTypeIcon,
  type TypeColor,
  type TypeLucideIcon,
} from "../core/type-config";
import { Button } from "./components/ui/button";
import { Input, Label, FieldHelp } from "./components/ui/fields";

const icons = {
  Shapes,
  FileText,
  NotebookPen,
  BookOpen,
  PenLine,
  Code2,
  Terminal,
  Bug,
  Wrench,
  Lightbulb,
  FlaskConical,
  Rocket,
  Target,
  Flag,
  CheckCircle2,
  Circle,
  Folder,
  Briefcase,
  CalendarDays,
  Clock3,
  Plane,
  Map,
  Compass,
  Mountain,
  Camera,
  Music2,
  Film,
  Palette,
  Heart,
  Dumbbell,
  GraduationCap,
  Coffee,
  Home,
  ShoppingBag,
  Gamepad2,
  Leaf,
};

export const COLOR_LABELS: Record<TypeColor, string> = {
  default: "中性",
  blue: "雾蓝",
  emerald: "青绿",
  amber: "暖琥珀",
  violet: "浅紫",
  rose: "柔玫瑰",
};

export const typeTint = (color?: string) =>
  color && color !== "default" ? `rgb(var(--bd-type-${color}))` : undefined;

export const typeBadgeStyle = (color?: string): CSSProperties | undefined =>
  color && color !== "default"
    ? {
        color: `rgb(var(--bd-type-${color}))`,
        backgroundColor: `rgb(var(--bd-type-${color}) / 0.11)`,
        borderColor: `rgb(var(--bd-type-${color}) / 0.26)`,
      }
    : undefined;

export function TypeIcon({
  type,
  className = "",
}: {
  type: Pick<ItemType, "icon" | "color">;
  className?: string;
}) {
  const value = type.icon || "Shapes";
  const Component = Object.hasOwn(icons, value)
    ? icons[value as TypeLucideIcon]
    : undefined;
  return (
    <span
      data-type-icon
      data-color={type.color || "default"}
      aria-hidden="true"
      className={`bd-inline-flex bd-h-4 bd-w-4 bd-shrink-0 bd-items-center bd-justify-center bd-text-sm bd-leading-none ${className}`.trim()}
      style={{ color: typeTint(type.color) }}
    >
      {Component ? (
        <Component
          size={16}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ fill: "none", stroke: "currentColor" }}
          focusable="false"
        />
      ) : (
        value
      )}
    </span>
  );
}

export function TypeBadge({
  type,
  className = "",
}: {
  type: Pick<ItemType, "name" | "icon" | "color">;
  className?: string;
}) {
  const tinted = Boolean(type.color && type.color !== "default");
  return (
    <span
      data-type-badge
      data-color={type.color || "default"}
      style={typeBadgeStyle(type.color)}
      className={`bd-inline-flex bd-max-w-full bd-items-center bd-gap-1 bd-rounded-md bd-border bd-px-1.5 bd-py-0.5 bd-text-xs bd-font-medium bd-leading-4 ${
        tinted ? "" : "bd-border-border bd-bg-muted/75 bd-text-muted-foreground"
      } ${className}`.trim()}
    >
      <TypeIcon type={type} />
      <span className="bd-truncate">{type.name}</span>
    </span>
  );
}

const PRIORITY_STYLES: Record<ItemPriority, string> = {
  high: "bd-border-warning/35 bd-bg-warning/12 bd-text-warning bd-font-medium",
  medium: "bd-border-border bd-bg-muted/70 bd-text-foreground/80 bd-font-normal",
  low: "bd-border-border/70 bd-bg-transparent bd-text-muted-foreground/80 bd-font-normal",
};

export function PriorityBadge({
  priority,
  className = "",
}: {
  priority?: ItemPriority;
  className?: string;
}) {
  if (!priority) return null;
  return (
    <span
      data-priority-badge={priority}
      className={`bd-inline-flex bd-shrink-0 bd-items-center bd-gap-1 bd-rounded-md bd-border bd-px-1.5 bd-py-0.5 bd-text-xs bd-leading-4 ${PRIORITY_STYLES[priority]} ${className}`.trim()}
    >
      {priority === "high" && (
        <span aria-hidden="true" className="bd-h-1.5 bd-w-1.5 bd-rounded-full bd-bg-current" />
      )}
      <span>{PRIORITY_LABELS[priority]}</span>
    </span>
  );
}

export function TypePicker({
  name,
  icon,
  color,
  onChange,
}: {
  name: string;
  icon: string;
  color: string;
  onChange(patch: { icon?: string; color?: string }): void;
}) {
  const baseId = useId();
  const [tab, setTab] = useState<"icons" | "emoji">(
    icon && !Object.hasOwn(icons, icon) ? "emoji" : "icons",
  );
  const [query, setQuery] = useState("");
  const [emoji, setEmoji] = useState(
    icon && !Object.hasOwn(icons, icon) ? icon : "",
  );
  const [error, setError] = useState("");

  const pick = (patch: { icon?: string; color?: string }) => {
    setError("");
    onChange(patch);
  };

  const matches = TYPE_ICONS.filter((entry) =>
    `${entry.name} ${entry.label} ${entry.keywords}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );

  return (
    <section data-type-picker className="bd-min-w-0 bd-space-y-3" aria-label="类型外观">
      <div className="bd-flex bd-flex-wrap bd-items-center bd-justify-between bd-gap-2">
        <div data-type-preview data-color={color || "default"} className="bd-min-w-0">
          <TypeBadge
            type={{
              name: name || "类型预览",
              icon: icon || undefined,
              color: color ? (color as TypeColor) : undefined,
            }}
            className="bd-max-w-52 bd-px-2.5 bd-py-1 bd-text-control"
          />
        </div>
        <div className="bd-flex bd-items-center bd-gap-1.5" role="group" aria-label="柔和配色">
          {TYPE_COLORS.map((value) => (
            <button
              key={value}
              type="button"
              aria-label={`配色：${COLOR_LABELS[value]}`}
              title={COLOR_LABELS[value]}
              aria-pressed={(color || "default") === value}
              onClick={() => pick({ color: value })}
              className={`bd-inline-flex bd-h-7 bd-w-7 bd-items-center bd-justify-center bd-rounded-full bd-border bd-transition-colors ${
                (color || "default") === value
                  ? "bd-border-foreground bd-bg-muted"
                  : "bd-border-transparent hover:bd-bg-muted"
              }`}
            >
              <span
                className="bd-h-3.5 bd-w-3.5 bd-rounded-full bd-bg-current"
                style={{
                  color: typeTint(value) || "rgb(var(--bd-muted-foreground))",
                }}
              />
            </button>
          ))}
        </div>
      </div>

      <div className="bd-flex bd-items-center bd-justify-between bd-gap-2">
        <div role="tablist" aria-label="图标来源" className="bd-flex bd-gap-1">
          {(
            [
              ["icons", "精选线框图标"],
              ["emoji", "单个 Emoji"],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              size="sm"
              variant="ghost"
              role="tab"
              aria-selected={tab === value}
              aria-pressed={tab === value}
              onClick={() => setTab(value)}
            >
              {label}
            </Button>
          ))}
        </div>
        {(icon || (color && color !== "default")) && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setEmoji("");
              pick({ icon: "", color: "default" });
            }}
          >
            恢复默认外观
          </Button>
        )}
      </div>

      {tab === "icons" ? (
        <div className="bd-space-y-2">
          <Input
            type="text"
            role="searchbox"
            aria-label="搜索图标"
            placeholder="搜索图标，如：写作、代码、旅行、灵感…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.preventDefault();
            }}
          />
          <div className="bd-grid bd-max-h-36 bd-grid-cols-[repeat(auto-fill,minmax(36px,1fr))] bd-gap-1 bd-overflow-y-auto bd-rounded-md bd-border bd-border-border bd-bg-background bd-p-1.5">
            {matches.map((entry) => (
              <Button
                key={entry.name}
                variant="ghost"
                size="icon"
                data-icon-option={entry.name}
                aria-label={entry.label}
                title={entry.label}
                aria-pressed={(icon || "Shapes") === entry.name}
                onClick={() => pick({ icon: entry.name })}
              >
                <TypeIcon
                  type={{
                    icon: entry.name,
                    color: color ? (color as TypeColor) : undefined,
                  }}
                />
              </Button>
            ))}
          </div>
          {!matches.length && (
            <FieldHelp>没有匹配的图标，试试「阅读」「计划」或「生活」。</FieldHelp>
          )}
        </div>
      ) : (
        <div className="bd-space-y-2">
          <Label htmlFor={`${baseId}-emoji`}>输入单个 Emoji</Label>
          <div className="bd-flex bd-gap-2">
            <Input
              id={`${baseId}-emoji`}
              value={emoji}
              maxLength={64}
              placeholder="例如 🌱、📝、🚀"
              onChange={(event) => setEmoji(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.preventDefault();
              }}
              className="bd-flex-1"
            />
            <Button
              variant="outline"
              onClick={() => {
                if (!isTypeIcon(emoji) || Object.hasOwn(icons, emoji)) {
                  setError("请输入单个有效的 Emoji 字符。");
                  return;
                }
                pick({ icon: emoji });
              }}
            >
              应用 Emoji
            </Button>
          </div>
          {error ? (
            <p role="alert" className="bd-text-xs bd-text-destructive">
              {error}
            </p>
          ) : (
            <FieldHelp>支持通过系统输入法 Emoji 面板输入，完全离线。</FieldHelp>
          )}
        </div>
      )}
    </section>
  );
}
