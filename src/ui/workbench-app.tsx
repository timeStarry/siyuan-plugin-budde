import { useEffect, useMemo, useRef, useState } from "react";
import type { BuddeState, Item, ItemPriority } from "../core/types";
import { PRIORITY_LABELS } from "../core/type-config";
import {
  CaptureRequest,
  getWorkspaceCounts,
  selectActiveItems,
  selectArchiveItems,
  selectPoolItems,
  type ActiveFocus,
  type CollectionLayout,
  type SortMode,
  type ViewFilters,
  type ViewMode,
} from "./model";
import { useBudde } from "./context";
import { usePane } from "./pane-context";
import { BoardView } from "./board-view";
import { DetailPanel } from "./detail-panel";
import { ItemCard, type ItemCardActions } from "./item-card";
import { ItemListView } from "./item-list";
import { SettingsModal, type SettingsOpenRequest } from "./settings-modal";
import { Icon } from "./components/icons";
import { Button } from "./components/ui/button";
import { Input, NativeSelect } from "./components/ui/fields";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "./components/ui/dropdown-menu";
import { cn } from "./lib/utils";

export function WorkbenchApp() {
  const { state, loading, fatalError, execute, confirm, refresh, exportJson, importJson } =
    useBudde();
  const { root } = usePane();

  const [view, setView] = useState<ViewMode>("pool");
  const [boardTypeId, setBoardTypeId] = useState<string>("general");
  const [captureTypeId, setCaptureTypeId] = useState<string>("general");
  const [captureDirectActive, setCaptureDirectActive] = useState<boolean>(false);
  const [captureTitle, setCaptureTitle] = useState("");
  const [capturing, setCapturing] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("");
  const [settingsRequest, setSettingsRequest] = useState<SettingsOpenRequest | null>(null);
  const [layoutMode, setLayoutMode] = useState<CollectionLayout>(() => {
    try {
      return window.localStorage.getItem("budde:collection-layout") === "list"
        ? "list"
        : "grid";
    } catch {
      return "grid";
    }
  });

  const handleLayoutModeChange = (next: CollectionLayout) => {
    setLayoutMode(next);
    try {
      window.localStorage.setItem("budde:collection-layout", next);
    } catch {
      // Ignore storage access errors in restricted webviews.
    }
  };

  const [filters, setFilters] = useState<ViewFilters>({
    query: "",
    typeId: "",
    includeActiveInPool: false,
    activeFocus: "all",
    hidePausedOnBoard: false,
    sort: "manual",
  });

  const captureInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const captureRequestRef = useRef(new CaptureRequest());
  const composingRef = useRef(false);

  // Keep boardTypeId & captureTypeId valid if types are deleted
  useEffect(() => {
    if (!state) return;
    if (!state.types.some((t) => t.id === boardTypeId)) {
      setBoardTypeId(state.types[0].id);
    }
    if (!state.types.some((t) => t.id === captureTypeId)) {
      const def = state.types.find((t) => t.id === "general") ?? state.types[0];
      setCaptureTypeId(def.id);
    }
    if (filters.typeId && !state.types.some((t) => t.id === filters.typeId)) {
      setFilters((prev) => ({ ...prev, typeId: "" }));
    }
  }, [state, boardTypeId, captureTypeId, filters.typeId]);

  // Contextually sync capture defaults when switching views/boardType
  const handleSwitchView = (nextView: ViewMode) => {
    setView(nextView);
    if (nextView === "board") {
      setCaptureTypeId(boardTypeId);
      setCaptureDirectActive(true);
    } else if (nextView === "active") {
      setCaptureDirectActive(true);
    } else if (nextView === "pool") {
      setCaptureDirectActive(false);
    }
  };

  const handleSelectBoardType = (nextTypeId: string) => {
    setBoardTypeId(nextTypeId);
    if (view === "board") {
      setCaptureTypeId(nextTypeId);
    }
  };

  // Global 'C' shortcut inside .budde instance to focus quick capture
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const ime = composingRef.current || event.isComposing || event.keyCode === 229;
      const target = event.target instanceof Element ? event.target : null;
      if (
        event.defaultPrevented ||
        ime ||
        event.repeat ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.shiftKey ||
        event.key.toLowerCase() !== "c" ||
        !target ||
        target.closest(".budde") !== root
      ) {
        return;
      }
      if (
        target.closest(
          'input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="menu"]',
        ) ||
        root.querySelector('[data-budde-modal="true"],[role="menu"]')
      ) {
        return;
      }
      event.preventDefault();
      if (view === "archive") setView("pool");
      requestAnimationFrame(() => captureInputRef.current?.focus());
    };
    root.addEventListener("keydown", onKeyDown);
    return () => root.removeEventListener("keydown", onKeyDown);
  }, [root, view]);

  const counts = useMemo(
    () => (state ? getWorkspaceCounts(state) : { pool: 0, active: 0, review: 0, paused: 0, completed: 0, archived: 0 }),
    [state],
  );

  const selectedItem = useMemo(
    () => state?.items.find((i) => i.id === selectedId),
    [state, selectedId],
  );

  const cardActions: ItemCardActions = useMemo(
    () => ({
      onSelect: (item) => setSelectedId(item.id),
      onPromote: (item) => {
        void execute(
          {
            kind: "item.update",
            id: item.id,
            expectedVersion: item.version,
            patch: { status: "active" },
          },
          { successMessage: "已开始推进，进入类型看板" },
        );
      },
      onTogglePin: (item) => {
        void execute(
          {
            kind: "item.update",
            id: item.id,
            expectedVersion: item.version,
            patch: { pinned: !item.pinned },
          },
          { successMessage: item.pinned ? "已取消置顶" : "已置顶事项" },
        );
      },
      onSetPriority: (item, priority: ItemPriority | null) => {
        void execute(
          {
            kind: "item.update",
            id: item.id,
            expectedVersion: item.version,
            patch: { priority },
          },
          {
            successMessage: priority
              ? `已设为「${PRIORITY_LABELS[priority]}」`
              : "已清除优先级",
          },
        );
      },
      onMoveStage: (item, stageId) => {
        const targetType = state?.types.find((t) => t.id === item.typeId);
        const stageName = targetType?.stages.find((s) => s.id === stageId)?.name ?? "";
        void execute(
          {
            kind: "item.update",
            id: item.id,
            expectedVersion: item.version,
            patch: {
              stageId,
              ...(item.status === "pool" ? { status: "active" } : {}),
            },
          },
          {
            successMessage:
              item.status === "pool"
                ? `已开始推进并移至「${stageName}」`
                : `已移至「${stageName}」`,
          },
        );
      },
      onTogglePause: (item) => {
        void execute(
          {
            kind: "item.update",
            id: item.id,
            expectedVersion: item.version,
            patch: { status: item.status === "paused" ? "active" : "paused" },
          },
          {
            successMessage: item.status === "paused" ? "已恢复推进" : "已暂停推进",
          },
        );
      },
      onArchive: (item, archived) => {
        void execute(
          {
            kind: "item.update",
            id: item.id,
            expectedVersion: item.version,
            patch: { status: archived ? "archived" : "pool" },
          },
          { successMessage: archived ? "已归档事项" : "已移出归档至想法池" },
        );
      },
      onDelete: async (item) => {
        const ok = await confirm({
          title: "永久删除该事项？",
          description: `将永久移除「${item.title}」（不会删除任何已关联的思源笔记正文）。`,
          confirmLabel: "永久删除",
          destructive: true,
        });
        if (!ok) return;
        const res = await execute(
          { kind: "item.delete", id: item.id },
          { successMessage: "已永久删除事项" },
        );
        if (res.ok && selectedId === item.id) {
          setSelectedId("");
        }
      },
    }),
    [execute, confirm, state, selectedId],
  );

  if (fatalError && !state) {
    return (
      <div className="bd-flex bd-h-full bd-flex-col bd-items-center bd-justify-center bd-gap-3 bd-p-6 bd-text-center">
        <span className="bd-text-destructive">
          <Icon name="alert" />
        </span>
        <h2 className="bd-text-base bd-font-semibold">无法加载 Budde 工作空间数据</h2>
        <p role="alert" className="bd-max-w-md bd-text-sm bd-text-muted-foreground">
          {fatalError}
        </p>
        <Button variant="outline" onClick={() => void refresh(true)}>
          <Icon name="refresh" />
          重试读取
        </Button>
      </div>
    );
  }

  if (loading || !state) {
    return (
      <div className="bd-flex bd-h-full bd-items-center bd-justify-center bd-p-6 bd-text-sm bd-text-muted-foreground">
        正在载入 Budde 想法池与看板…
      </div>
    );
  }

  const navItems: Array<{ id: ViewMode; label: string; icon: "pool" | "active" | "board"; count?: number; alertDot?: boolean }> = [
    { id: "pool", label: "想法池", icon: "pool", count: counts.pool },
    {
      id: "active",
      label: "正在推进",
      icon: "active",
      count: counts.active,
      alertDot: counts.review > 0,
    },
    { id: "board", label: "看板", icon: "board" },
  ];

  return (
    <div
      onCompositionStart={() => {
        composingRef.current = true;
      }}
      onCompositionEnd={() => {
        composingRef.current = false;
      }}
      className="bd-flex bd-h-full bd-min-h-0 bd-w-full bd-min-w-0 bd-flex-col"
    >
      <header
        data-budde-shell="header"
        className="app-header bd-flex bd-min-h-[52px] bd-shrink-0 bd-items-center bd-gap-4 bd-border-b bd-border-border bd-bg-card bd-px-4 bd-py-2 [@container(max-width:640px)]:bd-flex-wrap [@container(max-width:640px)]:bd-gap-2 [@container(max-width:640px)]:bd-px-3"
      >
        <div className="brand bd-flex bd-shrink-0 bd-items-center bd-gap-2 bd-pr-2">
          <Icon name="brand" />
          <span
            data-brand-wordmark
            className="bd-font-brand bd-text-lg bd-font-semibold bd-tracking-normal bd-whitespace-nowrap [font-synthesis:none]"
          >
            Budde
          </span>
        </div>

        <nav
          aria-label="主导航"
          className="main-nav bd-flex bd-min-w-0 bd-items-center bd-gap-1 [@container(max-width:640px)]:bd-order-3 [@container(max-width:640px)]:bd-w-full [@container(max-width:640px)]:bd-overflow-x-auto"
        >
          {navItems.map((nav) => {
            const active = view === nav.id;
            return (
              <Button
                key={nav.id}
                size="sm"
                variant="ghost"
                data-view={nav.id}
                aria-pressed={active}
                onClick={() => handleSwitchView(nav.id)}
                className="bd-border bd-border-transparent aria-pressed:bd-border-border aria-pressed:bd-bg-muted aria-pressed:bd-shadow-xs"
              >
                <Icon name={nav.icon} />
                <span>{nav.label}</span>
                {nav.count !== undefined && (
                  <span className="bd-text-xs bd-text-muted-foreground bd-tabular-nums">
                    {nav.count}
                  </span>
                )}
                {nav.alertDot && (
                  <span
                    title={`${counts.review} 个事项待复查`}
                    className="bd-h-1.5 bd-w-1.5 bd-rounded-full bd-bg-warning"
                  />
                )}
              </Button>
            );
          })}
        </nav>

        <div className="bd-ml-auto bd-flex bd-shrink-0 bd-items-center bd-gap-1">
          <Button
            size="sm"
            variant="ghost"
            data-view="archive"
            aria-pressed={view === "archive"}
            onClick={() => handleSwitchView("archive")}
          >
            <Icon name="archive" />
            <span className="[@container(max-width:520px)]:bd-sr-only">归档</span>
            {counts.archived > 0 && (
              <span className="bd-text-xs bd-text-muted-foreground bd-tabular-nums">
                {counts.archived}
              </span>
            )}
          </Button>

          <Button
            size="sm"
            variant="ghost"
            aria-label="管理类型与阶段"
            onClick={() =>
              setSettingsRequest({
                typeId: view === "board" ? boardTypeId : state.types[0].id,
              })
            }
          >
            <Icon name="settings" />
            <span className="[@container(max-width:720px)]:bd-sr-only">类型配置</span>
          </Button>

          <DropdownMenu label="数据与更多操作">
            <DropdownMenuItem onSelect={() => void exportJson()}>
              <Icon name="download" />
              导出 JSON 备份
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => fileInputRef.current?.click()}>
              <Icon name="upload" />
              导入 JSON 恢复…
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void refresh(true)}>
              <Icon name="refresh" />
              重新读取磁盘数据
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={async () => {
                const ok = await confirm({
                  title: "重置为默认类型与示例？",
                  description:
                    "将恢复「日常、写作、项目开发、阅读与课题」4 个默认类型及 7 条精选示例事项，替换当前 Budde 中的事项与类型配置（不影响任何思源笔记正文；如有重要记录建议先导出 JSON 备份）。",
                  confirmLabel: "确认重置示例",
                });
                if (!ok) return;
                const res = await execute(
                  {
                    kind: "state.resetDemo",
                    expectedRevision: state.revision,
                  },
                  { successMessage: "已恢复默认类型与示例事项" },
                );
                if (res.ok) {
                  setSelectedId("");
                  setFilters((prev) => ({
                    ...prev,
                    query: "",
                    typeId: "",
                    includeActiveInPool: false,
                    activeFocus: "all",
                  }));
                }
              }}
            >
              <Icon name="undo" />
              重置为默认示例…
            </DropdownMenuItem>
            <DropdownMenuItem
              destructive
              disabled={state.items.length === 0}
              onSelect={async () => {
                const ok = await confirm({
                  title: "清空全部事项？",
                  description: `将清空当前工作台中的全部 ${state.items.length} 个事项（含归档），当前自定义的类型与阶段配置保持不变，思源笔记正文不受影响。`,
                  confirmLabel: "确认清空事项",
                  destructive: true,
                });
                if (!ok) return;
                const res = await execute(
                  {
                    kind: "items.clearAll",
                    expectedRevision: state.revision,
                  },
                  { successMessage: "已清空全部事项" },
                );
                if (res.ok) {
                  setSelectedId("");
                }
              }}
            >
              <Icon name="trash" />
              清空全部事项…
            </DropdownMenuItem>
          </DropdownMenu>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              const text = await file.text();
              const ok = await confirm({
                title: "导入 JSON 备份？",
                description: `将使用「${file.name}」中的数据替换当前 Budde 状态（兼容 v1 与 v2 备份格式，不影响思源笔记正文）。建议导入前先导出一份当前备份。`,
                confirmLabel: "确认导入替换",
              });
              if (!ok) return;
              await importJson(text);
            }}
          />
        </div>
      </header>

      {view !== "archive" && (
        <section
          data-budde-shell="capture"
          aria-label="快速记录"
          className="capture-area bd-shrink-0 bd-border-b bd-border-border bd-bg-card bd-px-4 bd-py-2.5 [@container(max-width:640px)]:bd-px-3"
        >
          <form
            data-part="capture"
            noValidate
            onSubmit={async (e) => {
              e.preventDefault();
              if (composingRef.current || capturing || !captureTitle.trim()) return;
              setCapturing(true);
              const targetStatus = captureDirectActive ? "active" : "pool";
              const command = captureRequestRef.current.prepare({
                title: captureTitle,
                typeId: captureTypeId,
                status: targetStatus,
              });
              const res = await execute(command, {
                successMessage:
                  targetStatus === "active"
                    ? "已记录并直接开始推进"
                    : "已记入想法池",
              });
              setCapturing(false);
              if (res.ok) {
                captureRequestRef.current.success();
                setCaptureTitle("");
                captureInputRef.current?.focus();
              }
            }}
            className="bd-flex bd-flex-wrap bd-items-center bd-gap-2 bd-rounded-lg bd-border bd-border-border bd-bg-background bd-px-3 bd-py-1.5"
          >
            <span className="bd-text-muted-foreground">
              <Icon name="plus" />
            </span>
            <Input
              ref={captureInputRef}
              data-part="capture-title"
              maxLength={500}
              aria-label="想法标题"
              placeholder="先记一个标题，想推进时再展开… (按 C 聚焦)"
              autoComplete="off"
              value={captureTitle}
              disabled={capturing}
              onChange={(e) => setCaptureTitle(e.target.value)}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  (composingRef.current || e.nativeEvent.isComposing || e.keyCode === 229)
                ) {
                  e.preventDefault();
                }
              }}
              className="bd-h-8 bd-min-w-44 bd-flex-1 bd-border-transparent bd-bg-transparent bd-px-0 focus-visible:bd-ring-0"
            />

            <div className="bd-flex bd-items-center bd-gap-1.5">
              <NativeSelect
                data-part="create-type"
                aria-label="新事项类型"
                value={captureTypeId}
                disabled={capturing}
                onChange={(e) => setCaptureTypeId(e.target.value)}
                className="bd-h-8 bd-w-28 bd-text-xs"
              >
                {state.types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </NativeSelect>

              <Button
                size="sm"
                variant="ghost"
                aria-pressed={captureDirectActive}
                title={
                  captureDirectActive
                    ? "创建后直接进入看板首阶段开始推进"
                    : "仅存入想法池，暂不承诺推进"
                }
                onClick={() => setCaptureDirectActive(!captureDirectActive)}
                className="bd-h-8 bd-px-2 bd-text-xs"
              >
                <Icon name={captureDirectActive ? "active" : "pool"} />
                {captureDirectActive ? "直接推进" : "存想法池"}
              </Button>

              <Button
                size="sm"
                type="submit"
                disabled={capturing || !captureTitle.trim()}
                className="bd-h-8"
              >
                记下来
                <kbd
                  aria-hidden="true"
                  className="bd-rounded-sm bd-border bd-border-primary-foreground/25 bd-px-1 bd-text-[11px] bd-font-normal bd-opacity-80 [@container(max-width:640px)]:bd-hidden"
                >
                  ↵
                </kbd>
              </Button>
            </div>
          </form>
        </section>
      )}

      <main className="workspace bd-relative bd-flex bd-min-h-0 bd-min-w-0 bd-flex-1 bd-overflow-hidden">
        <div
          data-budde-shell="main"
          onClick={(e) => {
            if (!selectedId) return;
            const target = e.target as HTMLElement;
            if (
              !target.closest(
                'button,a,input,textarea,select,[role="button"],[role="menuitem"],[data-item-id],[data-list-row],[data-menu-owner]',
              )
            ) {
              setSelectedId("");
            }
          }}
          className="main-panel bd-flex bd-min-h-0 bd-min-w-0 bd-flex-1 bd-overflow-hidden"
        >
          {view === "board" ? (
            <BoardView
              state={state}
              boardTypeId={boardTypeId}
              onSelectBoardType={handleSelectBoardType}
              filters={filters}
              onFiltersChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
              selectedId={selectedId}
              cardActions={cardActions}
              onOpenSettings={(req) => setSettingsRequest(req ?? {})}
            />
          ) : view === "pool" ? (
            <PoolCollectionView
              state={state}
              filters={filters}
              onFiltersChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
              layoutMode={layoutMode}
              onLayoutModeChange={handleLayoutModeChange}
              selectedId={selectedId}
              cardActions={cardActions}
              onFocusCapture={() => captureInputRef.current?.focus()}
            />
          ) : view === "active" ? (
            <ActiveCollectionView
              state={state}
              counts={counts}
              filters={filters}
              onFiltersChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
              layoutMode={layoutMode}
              onLayoutModeChange={handleLayoutModeChange}
              selectedId={selectedId}
              cardActions={cardActions}
              onGoPool={() => handleSwitchView("pool")}
            />
          ) : (
            <ArchiveCollectionView
              state={state}
              filters={filters}
              onFiltersChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
              layoutMode={layoutMode}
              onLayoutModeChange={handleLayoutModeChange}
              selectedId={selectedId}
              cardActions={cardActions}
            />
          )}
        </div>

        <DetailPanel
          state={state}
          item={selectedItem}
          onClose={() => setSelectedId("")}
        />
      </main>

      <SettingsModal
        open={Boolean(settingsRequest)}
        state={state}
        initialRequest={settingsRequest}
        onClose={() => setSettingsRequest(null)}
      />
    </div>
  );
}

function PoolCollectionView({
  state,
  filters,
  onFiltersChange,
  layoutMode,
  onLayoutModeChange,
  selectedId,
  cardActions,
  onFocusCapture,
}: {
  state: BuddeState;
  filters: ViewFilters;
  onFiltersChange(patch: Partial<ViewFilters>): void;
  layoutMode: CollectionLayout;
  onLayoutModeChange(mode: CollectionLayout): void;
  selectedId: string;
  cardActions: ItemCardActions;
  onFocusCapture(): void;
}) {
  const items = selectPoolItems(state, filters);
  const hasFilters = Boolean(filters.query || filters.typeId);

  return (
    <div className="bd-flex bd-min-h-0 bd-min-w-0 bd-flex-1 bd-flex-col bd-gap-3 bd-p-4 [@container(max-width:640px)]:bd-p-3">
      <div className="bd-flex bd-shrink-0 bd-flex-wrap bd-items-center bd-justify-between bd-gap-2">
        <div className="bd-flex bd-items-center bd-gap-2.5">
          <h1 className="bd-text-lg bd-font-semibold bd-leading-6">想法池</h1>
          <span className="bd-text-xs bd-text-muted-foreground bd-tabular-nums">
            {items.length} 个事项
          </span>
          <Button
            size="sm"
            variant="ghost"
            aria-pressed={filters.includeActiveInPool}
            onClick={() =>
              onFiltersChange({ includeActiveInPool: !filters.includeActiveInPool })
            }
            className="bd-h-7 bd-px-2 bd-text-xs"
          >
            {filters.includeActiveInPool ? "已含推进中事项" : "仅显示待孵化想法"}
          </Button>
        </div>

        <FilterToolbar
          state={state}
          filters={filters}
          onFiltersChange={onFiltersChange}
          layoutMode={layoutMode}
          onLayoutModeChange={onLayoutModeChange}
        />
      </div>

      <div data-part="collection" className="bd-min-h-0 bd-flex-1 bd-overflow-y-auto bd-p-0.5">
        {items.length > 0 ? (
          layoutMode === "list" ? (
            <ItemListView
              state={state}
              items={items}
              selectedId={selectedId}
              filters={filters}
              onFiltersChange={onFiltersChange}
              actions={cardActions}
            />
          ) : (
            <div className="bd-grid bd-grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] bd-items-stretch bd-gap-2.5">
              {items.map((item: Item) => (
                <ItemCard
                  key={item.id}
                  state={state}
                  item={item}
                  selected={selectedId === item.id}
                  actions={cardActions}
                />
              ))}
            </div>
          )
        ) : (
          <EmptyCollectionState
            icon="pool"
            title={hasFilters ? "没有匹配筛选条件的事项" : "想法池很干净"}
            description={
              hasFilters
                ? "试试清除关键词或切换类型筛选。"
                : "随手记下零散念头，不需要排期，也不必先建文档；准备好投入精力时再点「开始推进」。"
            }
            actionLabel={hasFilters ? "清除筛选" : "记下一个想法"}
            onAction={() => {
              if (hasFilters) onFiltersChange({ query: "", typeId: "" });
              else onFocusCapture();
            }}
          />
        )}
      </div>
    </div>
  );
}

function ActiveCollectionView({
  state,
  counts,
  filters,
  onFiltersChange,
  layoutMode,
  onLayoutModeChange,
  selectedId,
  cardActions,
  onGoPool,
}: {
  state: BuddeState;
  counts: ReturnType<typeof getWorkspaceCounts>;
  filters: ViewFilters;
  onFiltersChange(patch: Partial<ViewFilters>): void;
  layoutMode: CollectionLayout;
  onLayoutModeChange(mode: CollectionLayout): void;
  selectedId: string;
  cardActions: ItemCardActions;
  onGoPool(): void;
}) {
  const items = selectActiveItems(state, filters);
  const focusTabs: Array<{ id: ActiveFocus; label: string; count: number; highlight?: boolean }> = [
    { id: "all", label: "推进中", count: counts.active },
    { id: "review", label: "需复查", count: counts.review, highlight: counts.review > 0 },
    { id: "paused", label: "已暂停", count: counts.paused },
    { id: "completed", label: "已完成", count: counts.completed },
  ];

  return (
    <div className="bd-flex bd-min-h-0 bd-min-w-0 bd-flex-1 bd-flex-col bd-gap-3 bd-p-4 [@container(max-width:640px)]:bd-p-3">
      <div className="bd-flex bd-shrink-0 bd-flex-wrap bd-items-center bd-justify-between bd-gap-2">
        <div className="bd-flex bd-flex-wrap bd-items-center bd-gap-1.5">
          <h1 className="bd-mr-2 bd-text-lg bd-font-semibold bd-leading-6">正在推进</h1>
          {focusTabs.map((tab) => (
            <Button
              key={tab.id}
              size="sm"
              variant="ghost"
              aria-pressed={filters.activeFocus === tab.id}
              onClick={() => onFiltersChange({ activeFocus: tab.id })}
              className={cn(
                "bd-h-7 bd-px-2.5 bd-text-xs",
                tab.highlight && filters.activeFocus !== tab.id && "bd-text-warning",
              )}
            >
              {tab.label}
              <span className="bd-tabular-nums bd-opacity-75">{tab.count}</span>
            </Button>
          ))}
        </div>

        <FilterToolbar
          state={state}
          filters={filters}
          onFiltersChange={onFiltersChange}
          layoutMode={layoutMode}
          onLayoutModeChange={onLayoutModeChange}
          showReviewSort
        />
      </div>

      <div data-part="collection" className="bd-min-h-0 bd-flex-1 bd-overflow-y-auto bd-p-0.5">
        {items.length > 0 ? (
          layoutMode === "list" ? (
            <ItemListView
              state={state}
              items={items}
              selectedId={selectedId}
              filters={filters}
              onFiltersChange={onFiltersChange}
              actions={cardActions}
            />
          ) : (
            <div className="bd-grid bd-grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] bd-items-stretch bd-gap-2.5">
              {items.map((item) => (
                <ItemCard
                  key={item.id}
                  state={state}
                  item={item}
                  selected={selectedId === item.id}
                  actions={cardActions}
                />
              ))}
            </div>
          )
        ) : (
          <EmptyCollectionState
            icon="active"
            title={
              filters.activeFocus === "review"
                ? "暂无超过复查周期的事项"
                : filters.activeFocus === "paused"
                  ? "当前没有暂停的事项"
                  : filters.activeFocus === "completed"
                    ? "当前没有未归档的完成事项"
                    : "还没有正在推进的事项"
            }
            description="记录不等于承诺。从想法池挑一两件眼下最想推进的事展开即可。"
            actionLabel="去想法池挑选"
            onAction={onGoPool}
          />
        )}
      </div>
    </div>
  );
}

function ArchiveCollectionView({
  state,
  filters,
  onFiltersChange,
  layoutMode,
  onLayoutModeChange,
  selectedId,
  cardActions,
}: {
  state: BuddeState;
  filters: ViewFilters;
  onFiltersChange(patch: Partial<ViewFilters>): void;
  layoutMode: CollectionLayout;
  onLayoutModeChange(mode: CollectionLayout): void;
  selectedId: string;
  cardActions: ItemCardActions;
}) {
  const { execute, confirm } = useBudde();
  const items = selectArchiveItems(state, filters);
  const totalArchived = state.items.filter((i) => i.status === "archived").length;

  return (
    <div className="bd-flex bd-min-h-0 bd-min-w-0 bd-flex-1 bd-flex-col bd-gap-3 bd-p-4 [@container(max-width:640px)]:bd-p-3">
      <div className="bd-flex bd-shrink-0 bd-flex-wrap bd-items-center bd-justify-between bd-gap-2">
        <div className="bd-flex bd-items-center bd-gap-2.5">
          <h1 className="bd-text-lg bd-font-semibold bd-leading-6">归档库</h1>
          <span className="bd-text-xs bd-text-muted-foreground bd-tabular-nums">
            {items.length} 个事项
          </span>
        </div>

        <div className="bd-flex bd-flex-wrap bd-items-center bd-gap-2">
          <FilterToolbar
            state={state}
            filters={filters}
            onFiltersChange={onFiltersChange}
            layoutMode={layoutMode}
            onLayoutModeChange={onLayoutModeChange}
          />
          {totalArchived > 0 && (
            <Button
              size="sm"
              variant="destructive"
              onClick={async () => {
                const ok = await confirm({
                  title: "清空全部归档事项？",
                  description: `将永久删除归档库中的 ${totalArchived} 个事项（不会删除任何思源笔记正文）。此操作不可恢复。`,
                  confirmLabel: "确认清空归档",
                  destructive: true,
                });
                if (!ok) return;
                await execute(
                  {
                    kind: "items.purgeArchived",
                    expectedRevision: state.revision,
                  },
                  { successMessage: `已永久清理 ${totalArchived} 个归档事项` },
                );
              }}
              className="bd-h-8"
            >
              <Icon name="trash" />
              清空归档
            </Button>
          )}
        </div>
      </div>

      <div data-part="collection" className="bd-min-h-0 bd-flex-1 bd-overflow-y-auto bd-p-0.5">
        {items.length > 0 ? (
          layoutMode === "list" ? (
            <ItemListView
              state={state}
              items={items}
              selectedId={selectedId}
              filters={filters}
              onFiltersChange={onFiltersChange}
              actions={cardActions}
            />
          ) : (
            <div className="bd-grid bd-grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] bd-items-stretch bd-gap-2.5">
              {items.map((item) => (
                <ItemCard
                  key={item.id}
                  state={state}
                  item={item}
                  selected={selectedId === item.id}
                  actions={cardActions}
                />
              ))}
            </div>
          )
        ) : (
          <EmptyCollectionState
            icon="archive"
            title="还没有归档事项"
            description="已完成或不再跟进的想法可归档收纳，不干扰日常注意力。"
          />
        )}
      </div>
    </div>
  );
}

function FilterToolbar({
  state,
  filters,
  onFiltersChange,
  layoutMode,
  onLayoutModeChange,
  showReviewSort = false,
}: {
  state: BuddeState;
  filters: ViewFilters;
  onFiltersChange(patch: Partial<ViewFilters>): void;
  layoutMode: CollectionLayout;
  onLayoutModeChange(mode: CollectionLayout): void;
  showReviewSort?: boolean;
}) {
  return (
    <div className="bd-flex bd-flex-wrap bd-items-center bd-gap-2 [@container(max-width:520px)]:bd-w-full">
      <div className="bd-relative bd-flex bd-w-48 bd-max-w-full bd-items-center [@container(max-width:520px)]:bd-w-full">
        <span className="bd-pointer-events-none bd-absolute bd-left-2.5 bd-text-muted-foreground">
          <Icon name="search" />
        </span>
        <Input
          type="text"
          role="searchbox"
          aria-label="搜索事项"
          placeholder="搜索标题、说明、笔记…"
          value={filters.query}
          onChange={(e) => onFiltersChange({ query: e.target.value })}
          className="bd-h-8 bd-pl-8 bd-text-xs"
        />
      </div>

      <NativeSelect
        aria-label="按类型筛选"
        value={filters.typeId}
        onChange={(e) => onFiltersChange({ typeId: e.target.value })}
        className="bd-h-8 bd-w-28 bd-text-xs [@container(max-width:520px)]:bd-min-w-0 [@container(max-width:520px)]:bd-flex-1"
      >
        <option value="">所有类型</option>
        {state.types.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </NativeSelect>

      <NativeSelect
        aria-label="排序方式"
        value={filters.sort}
        onChange={(e) =>
          onFiltersChange({ sort: e.target.value as SortMode, sortAsc: undefined })
        }
        className="bd-h-8 bd-w-32 bd-text-xs [@container(max-width:520px)]:bd-min-w-0 [@container(max-width:520px)]:bd-flex-1"
      >
        <option value="manual">置顶与默认</option>
        <option value="priority">按优先级</option>
        <option value="updated">最近更新</option>
        <option value="created">最近创建</option>
        <option value="type">按类型分组</option>
        <option value="title">按标题排序</option>
        {showReviewSort && <option value="review">待复查优先</option>}
      </NativeSelect>

      <div
        role="group"
        aria-label="视图布局"
        className="bd-inline-flex bd-h-8 bd-shrink-0 bd-items-center bd-rounded-md bd-border bd-border-input bd-bg-background bd-p-0.5"
      >
        <button
          type="button"
          aria-label="卡片视图"
          title="卡片视图"
          aria-pressed={layoutMode === "grid"}
          onClick={() => onLayoutModeChange("grid")}
          className={cn(
            "bd-inline-flex bd-h-full bd-w-7 bd-items-center bd-justify-center bd-rounded-sm bd-text-muted-foreground bd-transition-colors hover:bd-text-foreground focus-visible:bd-outline-none focus-visible:bd-ring-2 focus-visible:bd-ring-ring",
            layoutMode === "grid" && "bd-bg-card bd-text-foreground bd-shadow-xs",
          )}
        >
          <Icon name="grid" />
        </button>
        <button
          type="button"
          aria-label="列表视图"
          title="列表视图"
          aria-pressed={layoutMode === "list"}
          onClick={() => onLayoutModeChange("list")}
          className={cn(
            "bd-inline-flex bd-h-full bd-w-7 bd-items-center bd-justify-center bd-rounded-sm bd-text-muted-foreground bd-transition-colors hover:bd-text-foreground focus-visible:bd-outline-none focus-visible:bd-ring-2 focus-visible:bd-ring-ring",
            layoutMode === "list" && "bd-bg-card bd-text-foreground bd-shadow-xs",
          )}
        >
          <Icon name="list" />
        </button>
      </div>
    </div>
  );
}

function EmptyCollectionState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: "pool" | "active" | "archive";
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="empty-state bd-mx-auto bd-flex bd-h-full bd-max-w-md bd-flex-col bd-items-center bd-justify-center bd-gap-2.5 bd-p-6 bd-text-center">
      <span className="bd-rounded-full bd-bg-muted bd-p-3 bd-text-muted-foreground">
        <Icon name={icon} />
      </span>
      <h2 className="bd-text-sm bd-font-semibold">{title}</h2>
      <p className="bd-text-xs bd-leading-5 bd-text-muted-foreground">{description}</p>
      {actionLabel && onAction && (
        <Button size="sm" variant="outline" onClick={onAction} className="bd-mt-1">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
