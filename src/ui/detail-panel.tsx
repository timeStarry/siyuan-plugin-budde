import { useCallback, useEffect, useId, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { BuddeState, Item, NotebookSummary, NoteLink, NoteSummary } from "../core/types";
import { getStatusLabel, isCompleted, needsReview } from "./model";
import { useBudde } from "./context";
import { usePane } from "./pane-context";
import { TypeIcon } from "./type-presentation";
import { Icon } from "./components/icons";
import { Button } from "./components/ui/button";
import { Badge } from "./components/ui/badge";
import { FieldHelp, Input, Label, NativeSelect, Textarea } from "./components/ui/fields";
import { Tooltip } from "./components/ui/tooltip";
import { cn } from "./lib/utils";

export function DetailPanel({
  state,
  item,
  onClose,
}: {
  state: BuddeState;
  item: Item | undefined;
  onClose(): void;
}) {
  const { root } = usePane();
  const reduced = useReducedMotion();
  const [isOverlay, setIsOverlay] = useState(() => root.clientWidth < 860);
  const hostRef = useRef<HTMLDivElement>(null);
  const composingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const update = () => setIsOverlay(root.clientWidth < 860);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(root);
    return () => ro.disconnect();
  }, [root]);

  useEffect(() => {
    const isOpen = Boolean(item);
    const shouldInert = isOpen && isOverlay;
    const targets = root.querySelectorAll<HTMLElement>(
      '[data-budde-shell="header"],[data-budde-shell="capture"],[data-budde-shell="main"]',
    );
    if (!root.querySelector("[data-budde-modal-layer]")) {
      targets.forEach((el) => {
        el.inert = shouldInert;
      });
    }
    return () => {
      if (!root.querySelector("[data-budde-modal-layer]")) {
        targets.forEach((el) => {
          el.inert = false;
        });
      }
    };
  }, [item, isOverlay, root]);

  useEffect(() => {
    if (!item) return;
    const doc = root.ownerDocument;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || composingRef.current || e.isComposing || e.keyCode === 229) return;
      if (root.querySelector('[data-budde-modal-layer],[role="menu"]')) return;
      const active = doc.activeElement;
      const insideThisPane =
        !active ||
        active === doc.body ||
        active === doc.documentElement ||
        root.contains(active);
      if (!insideThisPane) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
      }
    };
    doc.addEventListener("keydown", onKeyDown);
    return () => doc.removeEventListener("keydown", onKeyDown);
  }, [item, root]);

  if (!item) return null;

  return (
    <div
      ref={hostRef}
      data-detail-overlay={isOverlay || undefined}
      onCompositionStart={() => {
        composingRef.current = true;
      }}
      onCompositionEnd={() => {
        composingRef.current = false;
      }}
      onMouseDown={(e) => {
        if (isOverlay && e.target === hostRef.current) {
          onClose();
        }
      }}
      className={cn(
        "bd-min-h-0 bd-shrink-0",
        isOverlay
          ? "bd-absolute bd-inset-0 bd-z-20 bd-flex bd-justify-end bd-bg-scrim/15 bd-backdrop-blur-[1px]"
          : "bd-relative bd-h-full",
      )}
    >
      <motion.aside
        key={item.id}
        initial={{ opacity: 0.85, x: reduced ? 0 : 12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: reduced ? 0 : 0.16, ease: [0.22, 1, 0.36, 1] }}
        role={isOverlay ? "dialog" : "complementary"}
        aria-modal={isOverlay ? "true" : undefined}
        aria-label="事项详情"
        className="detail-pane bd-flex bd-h-full bd-w-[392px] bd-max-w-full bd-flex-col bd-border-l bd-border-border bd-bg-card bd-text-foreground bd-shadow-sm"
      >
        <DetailContent state={state} item={item} onClose={onClose} />
      </motion.aside>
    </div>
  );
}

function DetailContent({
  state,
  item,
  onClose,
}: {
  state: BuddeState;
  item: Item;
  onClose(): void;
}) {
  const { execute, confirm, notes, toast } = useBudde();
  const fieldId = useId();

  const [title, setTitle] = useState(item.title);
  const [nextStep, setNextStep] = useState(item.nextStep);
  const [description, setDescription] = useState(item.description);
  const [baseVersion, setBaseVersion] = useState(item.version);
  const [saving, setSaving] = useState(false);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const composingRef = useRef(false);

  const dirty =
    title !== item.title ||
    nextStep !== item.nextStep ||
    description !== item.description;

  // Adopt external state updates seamlessly whenever user has no conflicting local text edits
  useEffect(() => {
    if (!dirty && !conflictMessage) {
      setTitle(item.title);
      setNextStep(item.nextStep);
      setDescription(item.description);
      setBaseVersion(item.version);
    }
  }, [item.title, item.nextStep, item.description, item.version, dirty, conflictMessage]);

  const saveDraft = useCallback(
    async (overrideLatestVersion = false) => {
      if (saving) return false;
      const trimmedTitle = title.trim();
      if (!trimmedTitle) {
        toast("事项标题不能为空。", "error");
        return false;
      }
      if (!dirty && !conflictMessage) return true;
      setSaving(true);
      const res = await execute(
        {
          kind: "item.update",
          id: item.id,
          expectedVersion: overrideLatestVersion ? item.version : baseVersion,
          patch: {
            title: trimmedTitle,
            nextStep,
            description,
          },
        },
        { silentError: true },
      );
      setSaving(false);
      if (res.ok) {
        const updated = res.result.state.items.find((i) => i.id === item.id);
        if (updated) {
          setTitle(updated.title);
          setNextStep(updated.nextStep);
          setDescription(updated.description);
          setBaseVersion(updated.version);
        }
        setConflictMessage(null);
        return true;
      }
      const isConflict =
        typeof res.error === "object" &&
        res.error !== null &&
        "code" in res.error &&
        res.error.code === "CONFLICT";
      if (isConflict) {
        setConflictMessage(res.message);
      } else {
        toast(res.message, "error");
      }
      return false;
    },
    [saving, title, dirty, conflictMessage, execute, item.id, item.version, baseVersion, nextStep, description, toast],
  );

  const discardDraft = () => {
    setTitle(item.title);
    setNextStep(item.nextStep);
    setDescription(item.description);
    setBaseVersion(item.version);
    setConflictMessage(null);
  };

  const handleCloseClick = async () => {
    if (dirty) {
      const ok = await saveDraft(false);
      if (!ok) return;
    }
    onClose();
  };

  const type = state.types.find((t) => t.id === item.typeId) ?? state.types[0];
  const statusInfo = getStatusLabel(state, item);
  const review = needsReview(state, item);
  const completed = isCompleted(state, item);
  const currentStageIndex = type.stages.findIndex((s) => s.id === item.stageId);

  const handleKeySave = (e: React.KeyboardEvent) => {
    if (composingRef.current || e.nativeEvent.isComposing || e.keyCode === 229) return;
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void saveDraft(false);
    }
  };

  return (
    <>
      <div className="detail-heading bd-flex bd-min-h-[52px] bd-shrink-0 bd-items-center bd-justify-between bd-gap-2 bd-border-b bd-border-border bd-px-4 bd-py-2.5">
        <div className="bd-flex bd-min-w-0 bd-items-center bd-gap-2">
          <Badge variant={statusInfo.tone}>{statusInfo.label}</Badge>
          {review && (
            <Badge variant="warning">
              <Icon name="clock" />
              需复查
            </Badge>
          )}
          <span
            role="status"
            aria-live="polite"
            className={cn(
              "bd-truncate bd-text-xs",
              conflictMessage
                ? "bd-text-destructive"
                : dirty
                  ? "bd-text-warning"
                  : "bd-text-muted-foreground",
            )}
          >
            {saving
              ? "保存中…"
              : conflictMessage
                ? "版本冲突"
                : dirty
                  ? "未保存"
                  : "已保存"}
          </span>
        </div>

        <div className="bd-flex bd-shrink-0 bd-items-center bd-gap-1">
          <Tooltip label={item.pinned ? "取消置顶" : "置顶事项"}>
            <Button
              variant="ghost"
              size="iconSm"
              aria-label={item.pinned ? "取消置顶" : "置顶事项"}
              aria-pressed={item.pinned}
              onClick={() => {
                void execute(
                  {
                    kind: "item.update",
                    id: item.id,
                    expectedVersion: item.version,
                    patch: { pinned: !item.pinned },
                  },
                  { successMessage: item.pinned ? "已取消置顶" : "已置顶" },
                );
              }}
            >
              <Icon name="pin" />
            </Button>
          </Tooltip>
          <Tooltip label="关闭详情 (Esc)">
            <Button
              variant="ghost"
              size="iconSm"
              aria-label="关闭详情"
              onClick={() => void handleCloseClick()}
            >
              <Icon name="close" />
            </Button>
          </Tooltip>
        </div>
      </div>

      {conflictMessage && (
        <div
          role="alert"
          className="bd-shrink-0 bd-space-y-2 bd-border-b bd-border-destructive/30 bd-bg-destructive/10 bd-px-4 bd-py-3 bd-text-xs bd-text-destructive"
        >
          <p className="bd-leading-5">{conflictMessage}</p>
          <div className="bd-flex bd-flex-wrap bd-gap-2">
            <Button
              size="sm"
              variant="destructive"
              onClick={() => void saveDraft(true)}
            >
              用当前草稿覆盖保存
            </Button>
            <Button size="sm" variant="outline" onClick={discardDraft}>
              放弃草稿并读取最新
            </Button>
          </div>
        </div>
      )}

      {dirty && !conflictMessage && (
        <div className="bd-flex bd-shrink-0 bd-items-center justify-between bd-gap-2 bd-border-b bd-border-border bd-bg-muted/60 bd-px-4 bd-py-2">
          <span className="bd-text-xs bd-text-muted-foreground">
            有未保存的文本修改（⌘/Ctrl+Enter 保存）
          </span>
          <div className="bd-flex bd-items-center bd-gap-1.5">
            <Button size="sm" variant="ghost" onClick={discardDraft} disabled={saving}>
              撤销
            </Button>
            <Button size="sm" onClick={() => void saveDraft(false)} disabled={saving}>
              保存
            </Button>
          </div>
        </div>
      )}

      <div
        onCompositionStart={() => {
          composingRef.current = true;
        }}
        onCompositionEnd={() => {
          composingRef.current = false;
        }}
        className="detail-body bd-min-h-0 bd-flex-1 bd-space-y-5 bd-overflow-y-auto bd-p-4"
      >
        <div className="bd-space-y-2">
          <Label htmlFor={`${fieldId}-title`} className="bd-sr-only">
            事项标题
          </Label>
          <Input
            id={`${fieldId}-title`}
            aria-label="事项标题"
            maxLength={500}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              if (title !== item.title && title.trim() && !conflictMessage) {
                void saveDraft(false);
              }
            }}
            onKeyDown={(e) => {
              if (composingRef.current || e.nativeEvent.isComposing || e.keyCode === 229) return;
              if (e.key === "Enter") {
                e.preventDefault();
                void saveDraft(false);
              }
            }}
            className="bd-h-auto bd-py-2 bd-text-base bd-font-semibold"
          />

          <div className="bd-flex bd-items-center bd-gap-2">
            <TypeIcon type={type} />
            <Label htmlFor={`${fieldId}-type`} className="bd-text-xs bd-text-muted-foreground">
              所属类型
            </Label>
            <NativeSelect
              id={`${fieldId}-type`}
              aria-label="事项类型"
              value={item.typeId}
              onChange={(e) => {
                const nextTypeId = e.target.value;
                if (nextTypeId === item.typeId) return;
                const nextType = state.types.find((t) => t.id === nextTypeId);
                if (!nextType) return;
                void execute(
                  {
                    kind: "item.update",
                    id: item.id,
                    expectedVersion: item.version,
                    patch: {
                      typeId: nextTypeId,
                      ...(dirty ? { title: title.trim() || item.title, nextStep, description } : {}),
                    },
                  },
                  { successMessage: `已迁移至「${nextType.name}」` },
                );
              }}
              className="bd-h-8 bd-w-auto bd-min-w-28 bd-text-xs"
            >
              {state.types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>

        <section className="stage-path bd-space-y-2.5" aria-label="阶段路径">
          <div className="bd-flex bd-items-center bd-justify-between">
            <h3 className="bd-text-xs bd-font-medium bd-text-muted-foreground">
              阶段
            </h3>
            <span className="bd-text-xs bd-text-muted-foreground bd-tabular-nums">
              {currentStageIndex >= 0
                ? `${currentStageIndex + 1} / ${type.stages.length}`
                : ""}
            </span>
          </div>
          <ol className="bd-space-y-1">
            {type.stages.map((stage, idx) => {
              const active = stage.id === item.stageId;
              return (
                <li key={stage.id} className="bd-relative bd-min-w-0">
                  {idx < type.stages.length - 1 && (
                    <span
                      aria-hidden="true"
                      className="bd-pointer-events-none bd-absolute bd-left-[15px] bd-top-5 -bd-bottom-3 bd-w-px bd-bg-border"
                    />
                  )}
                  <button
                    type="button"
                    aria-current={active ? "step" : undefined}
                    aria-pressed={active}
                    onClick={() => {
                      if (active && item.status !== "pool") return;
                      const willPromote =
                        item.status === "pool" && stage.id !== type.initialStageId;
                      void execute(
                        {
                          kind: "item.update",
                          id: item.id,
                          expectedVersion: item.version,
                          patch: {
                            stageId: stage.id,
                            ...(item.status === "pool" ? { status: "active" } : {}),
                            ...(dirty
                              ? { title: title.trim() || item.title, nextStep, description }
                              : {}),
                          },
                        },
                        {
                          successMessage:
                            item.status === "pool" || willPromote
                              ? `已开始推进并设为「${stage.name}」`
                              : `已切换至「${stage.name}」`,
                        },
                      );
                    }}
                    className={cn(
                      "bd-relative bd-flex bd-min-h-8 bd-w-full bd-items-start bd-gap-2.5 bd-rounded-md bd-px-2 bd-py-1.5 bd-text-left bd-text-xs bd-leading-5 bd-transition-colors focus-visible:bd-outline-none focus-visible:bd-ring-2 focus-visible:bd-ring-ring",
                      active
                        ? "bd-bg-muted bd-font-medium bd-text-foreground"
                        : "bd-text-muted-foreground hover:bd-bg-muted/60 hover:bd-text-foreground",
                    )}
                  >
                    <span className="bd-relative bd-z-10 bd-mt-1 bd-inline-flex bd-h-2.5 bd-w-2.5 bd-shrink-0 bd-items-center bd-justify-center bd-rounded-full bd-border bd-border-border bd-bg-card">
                      {active && (
                        <span
                          className={cn(
                            "bd-absolute -bd-inset-px bd-rounded-full bd-transition-colors",
                            stage.completed ? "bd-bg-success" : "bd-bg-primary",
                          )}
                        />
                      )}
                    </span>
                    <span className="bd-min-w-0 bd-flex-1 bd-break-words">
                      {stage.name}
                      {stage.completed && (
                        <span className="bd-ml-1.5 bd-text-success">· 完成阶段</span>
                      )}
                      {active && item.status === "pool" && (
                        <span className="bd-ml-1.5 bd-font-normal bd-text-muted-foreground">
                          （点击即开始推进）
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>

        <div className="bd-space-y-1.5">
          <Label htmlFor={`${fieldId}-next`} className="bd-text-xs bd-text-muted-foreground">
            下一步行动
          </Label>
          <Textarea
            id={`${fieldId}-next`}
            aria-label="下一步"
            rows={2}
            placeholder="写下紧接着要做的具体一步，留空也没关系…"
            value={nextStep}
            onChange={(e) => setNextStep(e.target.value)}
            onKeyDown={handleKeySave}
            onBlur={() => {
              if (nextStep !== item.nextStep && !conflictMessage) {
                void saveDraft(false);
              }
            }}
            className="bd-min-h-16 bd-text-sm"
          />
        </div>

        <div className="bd-space-y-1.5">
          <Label htmlFor={`${fieldId}-desc`} className="bd-text-xs bd-text-muted-foreground">
            简短背景说明
          </Label>
          <Textarea
            id={`${fieldId}-desc`}
            aria-label="简短说明"
            rows={3}
            placeholder="补充背景脉络；长篇内容建议直接关联或新建思源文档…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={handleKeySave}
            onBlur={() => {
              if (description !== item.description && !conflictMessage) {
                void saveDraft(false);
              }
            }}
            className="bd-min-h-20 bd-text-sm"
          />
        </div>

        <NoteLinksSection state={state} item={item} notes={notes} />
      </div>

      <div className="detail-footer bd-flex bd-shrink-0 bd-flex-wrap bd-items-center bd-gap-1.5 bd-border-t bd-border-border bd-bg-card bd-px-3.5 bd-py-2.5">
        {item.status !== "archived" && (
          <Button
            key="primary-status-action"
            size="sm"
            variant={item.status === "active" ? "outline" : "default"}
            onClick={() => {
              if (item.status === "pool") {
                void execute(
                  {
                    kind: "item.update",
                    id: item.id,
                    expectedVersion: item.version,
                    patch: {
                      status: "active",
                      ...(dirty ? { title: title.trim() || item.title, nextStep, description } : {}),
                    },
                  },
                  { successMessage: "已开始推进，进入类型看板" },
                );
              } else if (item.status === "paused") {
                void execute(
                  {
                    kind: "item.update",
                    id: item.id,
                    expectedVersion: item.version,
                    patch: { status: "active" },
                  },
                  { successMessage: "已恢复推进" },
                );
              } else {
                void execute(
                  {
                    kind: "item.update",
                    id: item.id,
                    expectedVersion: item.version,
                    patch: { status: "paused" },
                  },
                  { successMessage: "已暂停推进（原阶段保留）" },
                );
              }
            }}
          >
            <Icon
              name={
                item.status === "pool"
                  ? "active"
                  : item.status === "paused"
                    ? "play"
                    : "pause"
              }
            />
            {item.status === "pool"
              ? "开始推进"
              : item.status === "paused"
                ? "恢复推进"
                : "暂停"}
          </Button>
        )}
        {item.status === "active" && (
          <>
            {!completed && (
              <Button
                size="sm"
                variant={review ? "default" : "ghost"}
                onClick={() => {
                  void execute(
                    {
                      kind: "item.update",
                      id: item.id,
                      expectedVersion: item.version,
                      patch: { reviewedAt: new Date().toISOString() },
                    },
                    { successMessage: "已确认复查" },
                  );
                }}
              >
                <Icon name="check" />
                已复查
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                void execute(
                  {
                    kind: "item.update",
                    id: item.id,
                    expectedVersion: item.version,
                    patch: { status: "pool" },
                  },
                  { successMessage: "已退回想法池" },
                );
              }}
            >
              退回池子
            </Button>
          </>
        )}

        <div className="bd-ml-auto bd-flex bd-items-center bd-gap-1">
          <Tooltip label={item.status === "archived" ? "移出归档" : "归档事项"}>
            <Button
              variant="ghost"
              size="iconSm"
              aria-label={item.status === "archived" ? "移出归档" : "归档事项"}
              onClick={() => {
                void execute(
                  {
                    kind: "item.update",
                    id: item.id,
                    expectedVersion: item.version,
                    patch: {
                      status: item.status === "archived" ? "pool" : "archived",
                    },
                  },
                  {
                    successMessage:
                      item.status === "archived" ? "已移出归档" : "已归档事项",
                  },
                );
              }}
            >
              <Icon name={item.status === "archived" ? "undo" : "archive"} />
            </Button>
          </Tooltip>

          <Tooltip label="永久删除">
            <Button
              variant="ghost"
              size="iconSm"
              aria-label="永久删除事项"
              onClick={async () => {
                const ok = await confirm({
                  title: "永久删除该事项？",
                  description: `将从 Budde 中彻底移除「${item.title}」（不会删除任何已关联的思源笔记正文）。此操作不可撤销。`,
                  confirmLabel: "永久删除",
                  destructive: true,
                });
                if (!ok) return;
                const res = await execute(
                  {
                    kind: "item.delete",
                    id: item.id,
                  },
                  { successMessage: "已永久删除事项" },
                );
                if (res.ok) onClose();
              }}
              className="bd-text-muted-foreground hover:bd-bg-destructive/10 hover:bd-text-destructive"
            >
              <Icon name="trash" />
            </Button>
          </Tooltip>
        </div>
      </div>
    </>
  );
}

function NoteLinksSection({
  state,
  item,
  notes,
}: {
  state: BuddeState;
  item: Item;
  notes: ReturnType<typeof useBudde>["notes"];
}) {
  const { execute, toast } = useBudde();
  const [mode, setMode] = useState<"idle" | "search" | "create">("idle");
  const [role, setRole] = useState<NoteLink["role"]>("reference");

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<NoteSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [manualLoading, setManualLoading] = useState(false);

  // Create doc state
  const [notebooks, setNotebooks] = useState<NotebookSummary[]>([]);
  const [notebookId, setNotebookId] = useState(state.defaultNotebookId ?? "");
  const [creatingDoc, setCreatingDoc] = useState(false);

  useEffect(() => {
    setMode("idle");
    setSearchQuery("");
  }, [item.id]);

  useEffect(() => {
    if (mode !== "search") return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const list = await notes.search(searchQuery, ctrl.signal);
        if (!ctrl.signal.aborted) setResults(list);
      } catch {
        if (!ctrl.signal.aborted) setResults([]);
      } finally {
        if (!ctrl.signal.aborted) setSearching(false);
      }
    }, 160);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [mode, searchQuery, notes]);

  useEffect(() => {
    if (mode !== "create") return;
    const ctrl = new AbortController();
    void notes
      .listNotebooks(ctrl.signal)
      .then((list) => {
        if (ctrl.signal.aborted) return;
        setNotebooks(list);
        if (list.length > 0) {
          const preferred =
            list.find((nb) => nb.id === state.defaultNotebookId)?.id ?? list[0].id;
          setNotebookId(preferred);
        }
      })
      .catch((err) => {
        if (!ctrl.signal.aborted) {
          toast(err instanceof Error ? err.message : String(err), "error");
        }
      });
    return () => ctrl.abort();
  }, [mode, notes, state.defaultNotebookId, toast]);

  const attachNote = async (entry: { target: string; title: string; hpath?: string }) => {
    const rawId = entry.target.replace("siyuan://blocks/", "");
    if (item.links.some((l) => l.target.replace("siyuan://blocks/", "") === rawId)) {
      toast("该思源笔记已关联。", "info");
      return;
    }
    const nextLinks: NoteLink[] = [
      ...item.links,
      {
        id: crypto.randomUUID(),
        target: entry.target,
        title: entry.title,
        ...(entry.hpath ? { hpath: entry.hpath } : {}),
        role,
      },
    ];
    const res = await execute(
      {
        kind: "item.update",
        id: item.id,
        expectedVersion: item.version,
        patch: { links: nextLinks },
      },
      { successMessage: `已关联思源笔记「${entry.title}」` },
    );
    if (res.ok) {
      setSearchQuery("");
      setMode("idle");
    }
  };

  return (
    <section className="notes-section bd-space-y-2.5" aria-label="思源笔记关联">
      <div className="bd-flex bd-items-center bd-justify-between bd-gap-2">
        <h3 className="bd-text-xs bd-font-medium bd-text-muted-foreground">
          思源笔记（{item.links.length}）
        </h3>
        <div className="bd-flex bd-items-center bd-gap-1">
          <Button
            size="sm"
            variant={mode === "search" ? "default" : "outline"}
            onClick={() => {
              setRole("reference");
              setMode(mode === "search" ? "idle" : "search");
            }}
            className="bd-h-7 bd-px-2 bd-text-xs"
          >
            <Icon name="link" />
            关联已有
          </Button>
          <Button
            size="sm"
            variant={mode === "create" ? "default" : "outline"}
            onClick={() => {
              setRole("outcome");
              setMode(mode === "create" ? "idle" : "create");
            }}
            className="bd-h-7 bd-px-2 bd-text-xs"
          >
            <Icon name="noteAdd" />
            新建文档
          </Button>
        </div>
      </div>

      {mode === "search" && (
        <div className="bd-space-y-2.5 bd-rounded-md bd-border bd-border-border bd-bg-background bd-p-3">
          <div className="bd-flex bd-items-center bd-gap-2">
            <Input
              aria-label="搜索思源笔记或粘贴块 ID"
              placeholder="搜索文档标题，或直接粘贴块 ID / 链接…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === "Enter" && searchQuery.trim()) {
                  e.preventDefault();
                  if (results.length > 0) {
                    await attachNote(results[0]);
                  } else {
                    setManualLoading(true);
                    try {
                      const resolved = await notes.resolve(searchQuery.trim());
                      await attachNote(resolved);
                    } catch (err) {
                      toast(err instanceof Error ? err.message : String(err), "error");
                    } finally {
                      setManualLoading(false);
                    }
                  }
                }
              }}
              className="bd-h-8 bd-flex-1 bd-text-xs"
            />
            <NativeSelect
              aria-label="关联角色"
              value={role}
              onChange={(e) => setRole(e.target.value as NoteLink["role"])}
              className="bd-h-8 bd-w-20 bd-text-xs"
            >
              <option value="reference">资料</option>
              <option value="outcome">成果</option>
            </NativeSelect>
          </div>

          <div className="bd-max-h-44 bd-space-y-1 bd-overflow-y-auto">
            {searching || manualLoading ? (
              <p className="bd-py-3 bd-text-center bd-text-xs bd-text-muted-foreground">
                正在检索思源笔记…
              </p>
            ) : results.length > 0 ? (
              results.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => void attachNote(entry)}
                  className="bd-flex bd-w-full bd-items-center bd-gap-2 bd-rounded-sm bd-px-2 bd-py-1.5 bd-text-left bd-text-xs hover:bd-bg-muted focus-visible:bd-outline-none focus-visible:bd-ring-1 focus-visible:bd-ring-ring"
                >
                  <Icon name="note" className="bd-text-muted-foreground" />
                  <span className="bd-min-w-0 bd-flex-1">
                    <span className="bd-block bd-truncate bd-font-medium bd-text-foreground">
                      {entry.title}
                    </span>
                    {entry.hpath && (
                      <span className="bd-block bd-truncate bd-text-[11px] bd-text-muted-foreground">
                        {entry.hpath}
                      </span>
                    )}
                  </span>
                  <Badge>{entry.isDoc ? "文档" : "块"}</Badge>
                </button>
              ))
            ) : searchQuery.trim() ? (
              <div className="bd-flex bd-items-center bd-justify-between bd-gap-2 bd-py-2">
                <span className="bd-text-xs bd-text-muted-foreground">
                  未搜到匹配笔记，若为块 ID 可按回车直接验证
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={manualLoading}
                  onClick={async () => {
                    setManualLoading(true);
                    try {
                      const resolved = await notes.resolve(searchQuery.trim());
                      await attachNote(resolved);
                    } catch (err) {
                      toast(err instanceof Error ? err.message : String(err), "error");
                    } finally {
                      setManualLoading(false);
                    }
                  }}
                >
                  验证添加
                </Button>
              </div>
            ) : (
              <FieldHelp>输入关键词检索思源文档与块，或粘贴块引用。</FieldHelp>
            )}
          </div>
        </div>
      )}

      {mode === "create" && (
        <div className="bd-space-y-2.5 bd-rounded-md bd-border bd-border-border bd-bg-background bd-p-3">
          <p className="bd-text-xs bd-font-medium">
            以「{item.title}」新建思源文档并自动关联
          </p>
          <div className="bd-flex bd-items-center bd-gap-2">
            <NativeSelect
              aria-label="选择思源笔记本"
              value={notebookId}
              onChange={(e) => setNotebookId(e.target.value)}
              className="bd-h-8 bd-flex-1 bd-text-xs"
            >
              {notebooks.length === 0 ? (
                <option value="">未读取到打开的笔记本</option>
              ) : (
                notebooks.map((nb) => (
                  <option key={nb.id} value={nb.id}>
                    {nb.name}
                  </option>
                ))
              )}
            </NativeSelect>
            <NativeSelect
              aria-label="新建文档角色"
              value={role}
              onChange={(e) => setRole(e.target.value as NoteLink["role"])}
              className="bd-h-8 bd-w-20 bd-text-xs"
            >
              <option value="outcome">成果</option>
              <option value="reference">资料</option>
            </NativeSelect>
          </div>
          <div className="bd-flex bd-items-center bd-justify-end bd-gap-2">
            <Button size="sm" variant="ghost" onClick={() => setMode("idle")}>
              取消
            </Button>
            <Button
              size="sm"
              disabled={creatingDoc || !notebookId}
              onClick={async () => {
                setCreatingDoc(true);
                try {
                  const mdLines: string[] = [];
                  if (item.description.trim()) {
                    mdLines.push(`> ${item.description.trim().replace(/\n/g, "\n> ")}`, "");
                  }
                  if (item.nextStep.trim()) {
                    mdLines.push("## 下一步", "", `- [ ] ${item.nextStep.trim()}`, "");
                  }
                  const created = await notes.createDoc({
                    notebookId,
                    title: item.title,
                    markdown: mdLines.join("\n"),
                  });
                  await execute({ kind: "preference.setNotebook", notebookId });
                  await attachNote(created);
                  await notes.open(created.target);
                } catch (err) {
                  toast(err instanceof Error ? err.message : String(err), "error");
                } finally {
                  setCreatingDoc(false);
                }
              }}
            >
              {creatingDoc ? "创建中…" : "创建并打开"}
            </Button>
          </div>
        </div>
      )}

      {item.links.length > 0 ? (
        <ul className="bd-space-y-1.5">
          {item.links.map((link) => (
            <li
              key={link.id}
              className="bd-group bd-flex bd-items-center bd-gap-1.5 bd-rounded-md bd-border bd-border-border bd-bg-background bd-px-2.5 bd-py-2"
            >
              <button
                type="button"
                onClick={async () => {
                  try {
                    await notes.open(link.target);
                  } catch (err) {
                    toast(err instanceof Error ? err.message : String(err), "error");
                  }
                }}
                className="bd-flex bd-min-w-0 bd-flex-1 bd-items-center bd-gap-2 bd-text-left focus-visible:bd-outline-none focus-visible:bd-ring-1 focus-visible:bd-ring-ring"
              >
                <Icon name="note" className="bd-text-muted-foreground" />
                <span className="bd-min-w-0 bd-flex-1">
                  <span className="bd-block bd-truncate bd-text-xs bd-font-medium bd-text-foreground">
                    {link.title}
                  </span>
                  {link.hpath && (
                    <span className="bd-block bd-truncate bd-text-[11px] bd-text-muted-foreground">
                      {link.hpath}
                    </span>
                  )}
                </span>
                <Icon name="open" className="bd-text-muted-foreground" />
              </button>

              <Tooltip label="点击切换「资料 / 成果」角色">
                <button
                  type="button"
                  onClick={() => {
                    const nextLinks = item.links.map((l) =>
                      l.id === link.id
                        ? { ...l, role: l.role === "reference" ? ("outcome" as const) : ("reference" as const) }
                        : l,
                    );
                    void execute({
                      kind: "item.update",
                      id: item.id,
                      expectedVersion: item.version,
                      patch: { links: nextLinks },
                    });
                  }}
                  className="bd-shrink-0"
                >
                  <Badge variant={link.role === "outcome" ? "success" : "default"}>
                    {link.role === "outcome" ? "成果" : "资料"}
                  </Badge>
                </button>
              </Tooltip>

              <Tooltip label="移除关联（不删除笔记正文）">
                <Button
                  variant="ghost"
                  size="iconSm"
                  aria-label={`移除关联：${link.title}`}
                  onClick={() => {
                    void execute(
                      {
                        kind: "item.update",
                        id: item.id,
                        expectedVersion: item.version,
                        patch: {
                          links: item.links.filter((l) => l.id !== link.id),
                        },
                      },
                      { successMessage: "已移除笔记关联" },
                    );
                  }}
                >
                  <Icon name="close" />
                </Button>
              </Tooltip>
            </li>
          ))}
        </ul>
      ) : (
        <p className="bd-text-xs bd-leading-5 bd-text-muted-foreground">
          暂未关联思源笔记。可搜索已有文档，或一键新建同名文档展开写作。
        </p>
      )}
    </section>
  );
}
