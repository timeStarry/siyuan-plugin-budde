import { useEffect, useRef, useState } from "react";
import type { BuddeState, NoteSummary } from "../core/types";
import {
  DEFAULT_REVIEW_DAYS,
  REVIEW_DAY_PRESETS,
  STAGE_TEMPLATES,
  type StageTemplateId,
  type TypeColor,
} from "../core/type-config";
import { createTypePack, parseTypePack } from "../core/template";
import { useBudde } from "./context";
import { TypeIcon, TypePicker } from "./type-presentation";
import { Modal } from "./components/ui/modal";
import { Button } from "./components/ui/button";
import { Badge } from "./components/ui/badge";
import {
  FieldHelp,
  Input,
  Label,
  NativeSelect,
  Textarea,
} from "./components/ui/fields";
import { Icon } from "./components/icons";

export interface SettingsOpenRequest {
  typeId?: string;
  createNew?: boolean;
  deleteStageId?: string;
}

export function SettingsModal({
  open,
  state,
  initialRequest,
  onClose,
}: {
  open: boolean;
  state: BuddeState;
  initialRequest?: SettingsOpenRequest | null;
  onClose(): void;
}) {
  const { execute, notes, toast } = useBudde();
  const importInputRef = useRef<HTMLInputElement>(null);
  const [activeTypeId, setActiveTypeId] = useState(
    initialRequest?.typeId ?? state.types[0]?.id ?? "",
  );
  const [creatingNew, setCreatingNew] = useState(Boolean(initialRequest?.createNew));
  const [deletingStageId, setDeletingStageId] = useState<string | null>(
    initialRequest?.deleteStageId ?? null,
  );
  const [migrateStageTargetId, setMigrateStageTargetId] = useState("");

  // Create type state
  const [newName, setNewName] = useState("");
  const [newTemplate, setNewTemplate] = useState<StageTemplateId>("basic");
  const [newIcon, setNewIcon] = useState<string>(STAGE_TEMPLATES.basic.defaultIcon);
  const [newColor, setNewColor] = useState<string>(STAGE_TEMPLATES.basic.defaultColor);

  // Edit active type state
  const activeType =
    state.types.find((t) => t.id === activeTypeId) ?? state.types[0];
  const [typeName, setTypeName] = useState(activeType?.name ?? "");
  const [showAppearance, setShowAppearance] = useState(false);

  // Stage inline states
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [editingStageName, setEditingStageName] = useState("");
  const [addingStageName, setAddingStageName] = useState("");
  const [criteriaStageId, setCriteriaStageId] = useState<string | null>(null);
  const [newCriterionText, setNewCriterionText] = useState("");

  // Type Markdown doc template states
  const [templateDraft, setTemplateDraft] = useState(activeType?.docTemplate ?? "");
  const [pickingTemplateDoc, setPickingTemplateDoc] = useState(false);
  const [templateDocQuery, setTemplateDocQuery] = useState("");
  const [templateDocResults, setTemplateDocResults] = useState<NoteSummary[]>([]);
  const [loadingTemplateDoc, setLoadingTemplateDoc] = useState(false);

  // Delete type state
  const [confirmingDeleteType, setConfirmingDeleteType] = useState(false);
  const [migrateTypeTargetId, setMigrateTypeTargetId] = useState("");

  useEffect(() => {
    if (!open) return;
    if (initialRequest?.createNew) {
      setCreatingNew(true);
      setNewName("");
      setNewTemplate("basic");
      setNewIcon(STAGE_TEMPLATES.basic.defaultIcon);
      setNewColor(STAGE_TEMPLATES.basic.defaultColor);
    } else {
      setCreatingNew(false);
      const nextId =
        initialRequest?.typeId && state.types.some((t) => t.id === initialRequest.typeId)
          ? initialRequest.typeId
          : state.types[0].id;
      setActiveTypeId(nextId);
      setDeletingStageId(initialRequest?.deleteStageId ?? null);
      const targetType = state.types.find((t) => t.id === nextId) ?? state.types[0];
      const fallbackStage = targetType.stages.find(
        (s) => s.id !== initialRequest?.deleteStageId,
      );
      setMigrateStageTargetId(fallbackStage?.id ?? "");
    }
    setConfirmingDeleteType(false);
    setEditingStageId(null);
    setCriteriaStageId(null);
    setNewCriterionText("");
    setPickingTemplateDoc(false);
  }, [open, initialRequest]);

  useEffect(() => {
    setCriteriaStageId(null);
    setNewCriterionText("");
    setPickingTemplateDoc(false);
  }, [activeType?.id]);

  useEffect(() => {
    if (activeType) {
      setTypeName(activeType.name);
    }
  }, [activeType?.id, activeType?.name]);

  useEffect(() => {
    if (activeType) {
      setTemplateDraft(activeType.docTemplate ?? "");
    }
  }, [activeType?.id, activeType?.docTemplate]);

  useEffect(() => {
    if (activeType) {
      const otherType = state.types.find((t) => t.id !== activeType.id);
      setMigrateTypeTargetId(otherType?.id ?? "");
    }
  }, [activeType?.id, state.types]);

  useEffect(() => {
    if (!pickingTemplateDoc) return;
    let cancelled = false;
    const handle = window.setTimeout(() => {
      void notes.search(templateDocQuery).then((hits) => {
        if (!cancelled) setTemplateDocResults(hits.slice(0, 8));
      });
    }, 150);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [pickingTemplateDoc, templateDocQuery, notes]);

  const referencedItems = state.items.filter((i) => i.typeId === activeType.id);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="管理类型与阶段"
      maxWidthClass="bd-max-w-3xl"
    >
      <div className="bd-flex bd-shrink-0 bd-items-center bd-justify-between bd-border-b bd-border-border bd-px-5 bd-py-3.5">
        <div>
          <h2 className="bd-text-base bd-font-semibold">管理类型与阶段</h2>
          <p className="bd-text-xs bd-text-muted-foreground">
            自定义事项分类、专属阶段路径、图标配色及复查提醒周期
          </p>
        </div>
        <Button variant="ghost" size="iconSm" aria-label="关闭设置" onClick={onClose}>
          <Icon name="close" />
        </Button>
      </div>

      <div className="bd-grid bd-min-h-0 bd-flex-1 bd-grid-cols-[188px_minmax(0,1fr)] bd-overflow-hidden [@container(max-width:640px)]:bd-grid-cols-1">
        <aside className="bd-flex bd-flex-col bd-gap-1 bd-overflow-y-auto bd-border-r bd-border-border bd-bg-muted/45 bd-p-3 [@container(max-width:640px)]:bd-flex-row [@container(max-width:640px)]:bd-overflow-x-auto [@container(max-width:640px)]:bd-border-b [@container(max-width:640px)]:bd-border-r-0">
          {state.types.map((entry, idx) => (
            <div
              key={entry.id}
              data-settings-type-row={entry.id}
              className="bd-group bd-relative bd-flex bd-h-8 bd-shrink-0 bd-items-center"
            >
              <Button
                size="sm"
                variant="ghost"
                aria-pressed={!creatingNew && entry.id === activeType.id}
                onClick={() => {
                  setCreatingNew(false);
                  setActiveTypeId(entry.id);
                  setTypeName(entry.name);
                  setTemplateDraft(entry.docTemplate ?? "");
                  setDeletingStageId(null);
                  setConfirmingDeleteType(false);
                }}
                className="bd-w-full bd-min-w-0 bd-justify-start bd-px-2 group-hover:bd-bg-muted group-hover:bd-pr-12 group-hover:bd-text-foreground aria-pressed:group-hover:bd-bg-accent [@container(max-width:640px)]:bd-w-auto [@container(max-width:640px)]:group-hover:bd-pr-2"
              >
                <TypeIcon type={entry} />
                <span className="bd-min-w-0 bd-flex-1 bd-truncate bd-text-left" title={entry.name}>
                  {entry.name}
                </span>
              </Button>
              <div
                data-settings-type-actions
                className="bd-pointer-events-none bd-absolute bd-inset-y-0 bd-right-1 bd-flex bd-items-center bd-gap-0.5 bd-opacity-0 bd-transition-opacity group-hover:bd-pointer-events-auto group-hover:bd-opacity-100 group-focus-within:bd-pointer-events-auto group-focus-within:bd-opacity-100 [@media(hover:none)]:bd-pointer-events-auto [@media(hover:none)]:bd-opacity-100 [@container(max-width:640px)]:bd-hidden"
              >
                <button
                  type="button"
                  disabled={idx === 0}
                  aria-label={`上移类型：${entry.name}`}
                  title="上移"
                  onClick={() => {
                    const ids = state.types.map((t) => t.id);
                    [ids[idx], ids[idx - 1]] = [ids[idx - 1], ids[idx]];
                    void execute({
                      kind: "type.reorder",
                      ids,
                      expectedRevision: state.revision,
                    });
                  }}
                  className="bd-inline-flex bd-h-6 bd-w-5 bd-items-center bd-justify-center bd-rounded bd-text-muted-foreground bd-transition-colors hover:bd-bg-background/80 hover:bd-text-foreground disabled:bd-pointer-events-none disabled:bd-opacity-30"
                >
                  <Icon name="up" />
                </button>
                <button
                  type="button"
                  disabled={idx === state.types.length - 1}
                  aria-label={`下移类型：${entry.name}`}
                  title="下移"
                  onClick={() => {
                    const ids = state.types.map((t) => t.id);
                    [ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]];
                    void execute({
                      kind: "type.reorder",
                      ids,
                      expectedRevision: state.revision,
                    });
                  }}
                  className="bd-inline-flex bd-h-6 bd-w-5 bd-items-center bd-justify-center bd-rounded bd-text-muted-foreground bd-transition-colors hover:bd-bg-background/80 hover:bd-text-foreground disabled:bd-pointer-events-none disabled:bd-opacity-30"
                >
                  <Icon name="down" />
                </button>
              </div>
            </div>
          ))}

          <div className="bd-mt-2 bd-flex bd-flex-col bd-gap-1.5 [@container(max-width:640px)]:bd-mt-0 [@container(max-width:640px)]:bd-shrink-0 [@container(max-width:640px)]:bd-flex-row">
            <Button
              size="sm"
              variant={creatingNew ? "default" : "outline"}
              onClick={() => {
                setCreatingNew(true);
                setNewName("");
              }}
            >
              <Icon name="plus" />
              新建类型
            </Button>
            <input
              ref={importInputRef}
              type="file"
              accept=".json,application/json"
              className="bd-hidden"
              aria-label="导入类型包文件"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                void file
                  .text()
                  .then((text) => {
                    const pack = parseTypePack(text);
                    return execute(
                      {
                        kind: "type.import",
                        pack,
                        expectedRevision: state.revision,
                      },
                      { successMessage: `已导入类型「${pack.type.name}」` },
                    );
                  })
                  .then((res) => {
                    if (res.ok) {
                      const imported = res.result.state.types[res.result.state.types.length - 1];
                      if (imported) {
                        setCreatingNew(false);
                        setActiveTypeId(imported.id);
                        setTypeName(imported.name);
                        setTemplateDraft(imported.docTemplate ?? "");
                      }
                    }
                  })
                  .catch((err) => {
                    toast(
                      err instanceof Error ? err.message : "类型包导入失败",
                      "error",
                    );
                  });
              }}
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => importInputRef.current?.click()}
            >
              <Icon name="upload" />
              导入类型…
            </Button>
          </div>
        </aside>

        <div className="bd-min-h-0 bd-space-y-5 bd-overflow-y-auto bd-p-5">
          {creatingNew ? (
            <form
              className="bd-space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newName.trim()) return;
                const res = await execute(
                  {
                    kind: "type.create",
                    expectedRevision: state.revision,
                    name: newName.trim(),
                    template: newTemplate,
                    icon: newIcon || null,
                    color: newColor ? (newColor as TypeColor) : null,
                  },
                  { successMessage: `已创建类型「${newName.trim()}」` },
                );
                if (res.ok) {
                  const created = res.result.state.types.at(-1);
                  setCreatingNew(false);
                  if (created) {
                    setActiveTypeId(created.id);
                    setTypeName(created.name);
                    setTemplateDraft(created.docTemplate ?? "");
                  }
                }
              }}
            >
              <h3 className="bd-text-sm bd-font-semibold">新建事项类型</h3>
              <div className="bd-grid bd-grid-cols-2 bd-gap-3 [@container(max-width:520px)]:bd-grid-cols-1">
                <div className="bd-space-y-1.5">
                  <Label>类型名称</Label>
                  <Input
                    data-autofocus
                    placeholder="例如：读书、研究课题、视频制作…"
                    value={newName}
                    maxLength={120}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </div>
                <div className="bd-space-y-1.5">
                  <Label>初始阶段模板</Label>
                  <NativeSelect
                    value={newTemplate}
                    onChange={(e) => {
                      const tpl = e.target.value as StageTemplateId;
                      setNewTemplate(tpl);
                      setNewIcon(STAGE_TEMPLATES[tpl].defaultIcon);
                      setNewColor(STAGE_TEMPLATES[tpl].defaultColor);
                    }}
                  >
                    {Object.entries(STAGE_TEMPLATES).map(([id, tpl]) => (
                      <option key={id} value={id}>
                        {tpl.label}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              </div>

              <TypePicker
                name={newName}
                icon={newIcon}
                color={newColor}
                onChange={(patch) => {
                  if (patch.icon !== undefined) setNewIcon(patch.icon);
                  if (patch.color !== undefined) setNewColor(patch.color);
                }}
              />

              <div className="bd-flex bd-justify-end bd-gap-2 bd-pt-2">
                <Button
                  variant="ghost"
                  onClick={() => setCreatingNew(false)}
                >
                  取消
                </Button>
                <Button type="submit" disabled={!newName.trim()}>
                  创建类型
                </Button>
              </div>
            </form>
          ) : (
            <>
              <section className="bd-space-y-3" aria-label="类型基本设置">
                <div className="bd-flex bd-flex-wrap bd-items-end bd-gap-3">
                  <div className="bd-min-w-44 bd-flex-1 bd-space-y-1.5">
                    <Label>类型名称</Label>
                    <div className="bd-flex bd-gap-2">
                      <Input
                        aria-label="类型名称"
                        value={typeName}
                        maxLength={120}
                        onChange={(e) => setTypeName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && typeName.trim() && typeName.trim() !== activeType.name) {
                            e.preventDefault();
                            void execute(
                              {
                                kind: "type.update",
                                id: activeType.id,
                                name: typeName.trim(),
                                expectedRevision: state.revision,
                              },
                              { successMessage: "类型名称已保存" },
                            );
                          }
                        }}
                      />
                      {typeName.trim() !== activeType.name && (
                        <Button
                          disabled={!typeName.trim()}
                          onClick={() => {
                            void execute(
                              {
                                kind: "type.update",
                                id: activeType.id,
                                name: typeName.trim(),
                                expectedRevision: state.revision,
                              },
                              { successMessage: "类型名称已保存" },
                            );
                          }}
                        >
                          保存
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="bd-w-36 bd-space-y-1.5">
                    <Label>新建默认落点</Label>
                    <NativeSelect
                      aria-label="初始阶段"
                      value={activeType.initialStageId}
                      onChange={(e) => {
                        void execute(
                          {
                            kind: "type.update",
                            id: activeType.id,
                            name: activeType.name,
                            initialStageId: e.target.value,
                            expectedRevision: state.revision,
                          },
                          { successMessage: "初始阶段已更新" },
                        );
                      }}
                    >
                      {activeType.stages.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>

                  <div className="bd-w-40 bd-space-y-1.5">
                    <Label>停滞复查提醒</Label>
                    <NativeSelect
                      aria-label="复查周期"
                      value={
                        activeType.reviewDays === null
                          ? "off"
                          : String(activeType.reviewDays ?? DEFAULT_REVIEW_DAYS)
                      }
                      onChange={(e) => {
                        const raw = e.target.value;
                        const reviewDays = raw === "off" ? null : Number(raw);
                        void execute(
                          {
                            kind: "type.update",
                            id: activeType.id,
                            name: activeType.name,
                            reviewDays,
                            expectedRevision: state.revision,
                          },
                          {
                            successMessage:
                              reviewDays === null
                                ? "已关闭该类型的复查提醒"
                                : `复查周期已设为 ${reviewDays} 天`,
                          },
                        );
                      }}
                    >
                      {REVIEW_DAY_PRESETS.map((preset) => (
                        <option
                          key={String(preset.value)}
                          value={preset.value === null ? "off" : String(preset.value)}
                        >
                          {preset.label}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                </div>

                <div className="bd-flex bd-flex-wrap bd-items-center bd-gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowAppearance(!showAppearance)}
                  >
                    <TypeIcon type={activeType} />
                    {showAppearance ? "收起图标与配色设置" : "更换图标与配色"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const pack = createTypePack(activeType);
                      const data = JSON.stringify(pack, null, 2);
                      const blob = new Blob([data], { type: "application/json" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      const safeName =
                        activeType.name.replace(/[^\p{L}\p{N}_-]+/gu, "-") || "type";
                      a.download = `budde-type-${safeName}.json`;
                      a.click();
                      setTimeout(() => URL.revokeObjectURL(url), 100);
                      toast(
                        `已导出类型包「${activeType.name}」`,
                        "success",
                      );
                    }}
                  >
                    <Icon name="download" />
                    导出此类型
                  </Button>
                </div>

                {showAppearance && (
                  <div className="bd-rounded-md bd-border bd-border-border bd-bg-muted/30 bd-p-3.5">
                    <TypePicker
                      name={typeName || activeType.name}
                      icon={activeType.icon ?? ""}
                      color={activeType.color ?? "default"}
                      onChange={(patch) => {
                        void execute({
                          kind: "type.update",
                          id: activeType.id,
                          name: activeType.name,
                          ...(patch.icon !== undefined
                            ? { icon: patch.icon || null }
                            : {}),
                          ...(patch.color !== undefined
                            ? {
                                color:
                                  patch.color && patch.color !== "default"
                                    ? (patch.color as TypeColor)
                                    : null,
                              }
                            : {}),
                          expectedRevision: state.revision,
                        });
                      }}
                    />
                  </div>
                )}
              </section>

              <section className="bd-space-y-2.5" aria-label="阶段列表">
                <div className="bd-flex bd-items-center bd-justify-between">
                  <h3 className="bd-text-xs bd-font-semibold bd-text-muted-foreground">
                    阶段流程（{activeType.stages.length}）
                  </h3>
                  <FieldHelp>「完成阶段」决定事项何时视为已完成，与排列位置无关</FieldHelp>
                </div>

                <ol className="bd-divide-y bd-divide-border bd-rounded-md bd-border bd-border-border">
                  {activeType.stages.map((stage, idx) => {
                    const stageItems = referencedItems.filter(
                      (i) => i.stageId === stage.id,
                    );
                    const isDeleting = deletingStageId === stage.id;
                    const isEditing = editingStageId === stage.id;
                    const stageCriteria = stage.criteria ?? [];
                    const isCriteriaOpen = criteriaStageId === stage.id;

                    return (
                      <li key={stage.id} className="bd-space-y-2 bd-p-2.5">
                        <div className="bd-flex bd-flex-wrap bd-items-center bd-gap-2">
                          {isEditing ? (
                            <div className="bd-flex bd-min-w-44 bd-flex-1 bd-items-center bd-gap-1.5">
                              <Input
                                value={editingStageName}
                                maxLength={120}
                                onChange={(e) => setEditingStageName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && editingStageName.trim()) {
                                    e.preventDefault();
                                    void execute(
                                      {
                                        kind: "stage.update",
                                        typeId: activeType.id,
                                        id: stage.id,
                                        name: editingStageName.trim(),
                                        completed: stage.completed,
                                        expectedRevision: state.revision,
                                      },
                                      { successMessage: "阶段已更新" },
                                    ).then((r) => {
                                      if (r.ok) setEditingStageId(null);
                                    });
                                  } else if (e.key === "Escape") {
                                    setEditingStageId(null);
                                  }
                                }}
                                className="bd-h-8 bd-text-xs"
                              />
                              <Button
                                size="sm"
                                onClick={() => {
                                  if (!editingStageName.trim()) return;
                                  void execute(
                                    {
                                      kind: "stage.update",
                                      typeId: activeType.id,
                                      id: stage.id,
                                      name: editingStageName.trim(),
                                      completed: stage.completed,
                                      expectedRevision: state.revision,
                                    },
                                    { successMessage: "阶段已更新" },
                                  ).then((r) => {
                                    if (r.ok) setEditingStageId(null);
                                  });
                                }}
                              >
                                保存
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditingStageId(null)}
                              >
                                取消
                              </Button>
                            </div>
                          ) : (
                            <div className="bd-flex bd-min-w-32 bd-flex-1 bd-items-center bd-gap-2">
                              <span className="bd-truncate bd-text-sm bd-font-medium">
                                {stage.name}
                              </span>
                              {stage.id === activeType.initialStageId && (
                                <Badge>初始</Badge>
                              )}
                              {stage.completed && (
                                <Badge variant="success">完成阶段</Badge>
                              )}
                              {stageItems.length > 0 && (
                                <span className="bd-text-xs bd-text-muted-foreground bd-tabular-nums">
                                  ({stageItems.length} 项)
                                </span>
                              )}
                            </div>
                          )}

                          <div className="bd-flex bd-items-center bd-gap-1">
                            <Button
                              size="sm"
                              variant={isCriteriaOpen ? "outline" : "ghost"}
                              aria-pressed={isCriteriaOpen}
                              aria-label={`准出项：${stage.name}`}
                              onClick={() => {
                                setCriteriaStageId(isCriteriaOpen ? null : stage.id);
                                setNewCriterionText("");
                              }}
                              className="bd-h-7 bd-px-2 bd-text-xs bd-tabular-nums"
                            >
                              <Icon name="checklist" />
                              准出项{stageCriteria.length > 0 ? ` (${stageCriteria.length})` : ""}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-pressed={stage.completed}
                              onClick={() => {
                                void execute({
                                  kind: "stage.update",
                                  typeId: activeType.id,
                                  id: stage.id,
                                  name: stage.name,
                                  completed: !stage.completed,
                                  expectedRevision: state.revision,
                                });
                              }}
                              className="bd-h-7 bd-px-2 bd-text-xs"
                            >
                              {stage.completed ? "取消完成" : "设为完成"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="iconSm"
                              disabled={idx === 0}
                              aria-label={`上移阶段：${stage.name}`}
                              onClick={() => {
                                const ids = activeType.stages.map((s) => s.id);
                                [ids[idx], ids[idx - 1]] = [ids[idx - 1], ids[idx]];
                                void execute({
                                  kind: "stage.reorder",
                                  typeId: activeType.id,
                                  ids,
                                  expectedRevision: state.revision,
                                });
                              }}
                            >
                              <Icon name="up" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="iconSm"
                              disabled={idx === activeType.stages.length - 1}
                              aria-label={`下移阶段：${stage.name}`}
                              onClick={() => {
                                const ids = activeType.stages.map((s) => s.id);
                                [ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]];
                                void execute({
                                  kind: "stage.reorder",
                                  typeId: activeType.id,
                                  ids,
                                  expectedRevision: state.revision,
                                });
                              }}
                            >
                              <Icon name="down" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="iconSm"
                              aria-label={`重命名阶段：${stage.name}`}
                              onClick={() => {
                                setEditingStageId(stage.id);
                                setEditingStageName(stage.name);
                              }}
                            >
                              <Icon name="edit" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="iconSm"
                              disabled={activeType.stages.length <= 1}
                              aria-label={`删除阶段：${stage.name}`}
                              onClick={() => {
                                if (
                                  stageItems.length === 0 &&
                                  stage.id !== activeType.initialStageId
                                ) {
                                  void execute(
                                    {
                                      kind: "stage.delete",
                                      typeId: activeType.id,
                                      id: stage.id,
                                      expectedRevision: state.revision,
                                    },
                                    { successMessage: `已删除阶段「${stage.name}」` },
                                  );
                                } else {
                                  setDeletingStageId(isDeleting ? null : stage.id);
                                  const candidate = activeType.stages.find(
                                    (s) => s.id !== stage.id,
                                  );
                                  setMigrateStageTargetId(candidate?.id ?? "");
                                }
                              }}
                            >
                              <Icon name="trash" />
                            </Button>
                          </div>
                        </div>

                        {isCriteriaOpen && (
                          <div className="bd-space-y-2 bd-rounded-md bd-border bd-border-border/80 bd-bg-muted/30 bd-p-2.5">
                            <div className="bd-flex bd-items-center bd-justify-between bd-gap-2">
                              <span className="bd-text-xs bd-font-medium bd-text-muted-foreground">
                                「{stage.name}」建议准出检查项（仅提示，不阻止推进）
                              </span>
                            </div>
                            {stageCriteria.length > 0 && (
                              <ul className="bd-space-y-1">
                                {stageCriteria.map((criterion) => (
                                  <li
                                    key={criterion.id}
                                    className="bd-flex bd-items-center bd-justify-between bd-gap-2 bd-rounded bd-bg-background/80 bd-px-2 bd-py-1 bd-text-xs"
                                  >
                                    <span className="bd-min-w-0 bd-flex-1 bd-truncate">
                                      {criterion.text}
                                    </span>
                                    <button
                                      type="button"
                                      aria-label={`删除准出项：${criterion.text}`}
                                      onClick={() => {
                                        const nextCriteria = stageCriteria.filter(
                                          (c) => c.id !== criterion.id,
                                        );
                                        void execute(
                                          {
                                            kind: "stage.update",
                                            typeId: activeType.id,
                                            id: stage.id,
                                            name: stage.name,
                                            completed: stage.completed,
                                            criteria: nextCriteria.length > 0 ? nextCriteria : null,
                                            expectedRevision: state.revision,
                                          },
                                          { successMessage: "已更新阶段准出项" },
                                        );
                                      }}
                                      className="bd-flex bd-h-5 bd-w-5 bd-shrink-0 bd-items-center bd-justify-center bd-rounded bd-text-muted-foreground hover:bd-bg-muted hover:bd-text-foreground"
                                    >
                                      ×
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                            <form
                              className="bd-flex bd-items-center bd-gap-1.5"
                              onSubmit={async (e) => {
                                e.preventDefault();
                                const text = newCriterionText.trim();
                                if (!text) return;
                                const nextCriteria = [
                                  ...stageCriteria.map((c) => ({ id: c.id, text: c.text })),
                                  { text },
                                ];
                                const res = await execute(
                                  {
                                    kind: "stage.update",
                                    typeId: activeType.id,
                                    id: stage.id,
                                    name: stage.name,
                                    completed: stage.completed,
                                    criteria: nextCriteria,
                                    expectedRevision: state.revision,
                                  },
                                  { successMessage: "已添加阶段准出项" },
                                );
                                if (res.ok) setNewCriterionText("");
                              }}
                            >
                              <Input
                                value={newCriterionText}
                                maxLength={160}
                                placeholder="输入阶段准出检查项，按回车添加…"
                                aria-label={`新增「${stage.name}」准出检查项`}
                                onChange={(e) => setNewCriterionText(e.target.value)}
                                className="bd-h-7 bd-text-xs"
                              />
                              <Button
                                type="submit"
                                size="sm"
                                variant="outline"
                                disabled={!newCriterionText.trim()}
                                className="bd-h-7 bd-shrink-0 bd-px-2.5 bd-text-xs"
                              >
                                添加
                              </Button>
                            </form>
                          </div>
                        )}

                        {isDeleting && (
                          <div className="bd-flex bd-flex-wrap bd-items-center bd-justify-between bd-gap-2 bd-rounded-md bd-border bd-border-destructive/30 bd-bg-destructive/5 bd-p-2.5 bd-text-xs">
                            <span>
                              将此阶段的 {stageItems.length} 个事项
                              {stage.id === activeType.initialStageId ? "及初始落点" : ""}
                              迁移至：
                            </span>
                            <div className="bd-flex bd-items-center bd-gap-2">
                              <NativeSelect
                                aria-label="迁移目标阶段"
                                value={migrateStageTargetId}
                                onChange={(e) => setMigrateStageTargetId(e.target.value)}
                                className="bd-h-7 bd-w-36 bd-text-xs"
                              >
                                {activeType.stages
                                  .filter((s) => s.id !== stage.id)
                                  .map((s) => (
                                    <option key={s.id} value={s.id}>
                                      {s.name}
                                    </option>
                                  ))}
                              </NativeSelect>
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={!migrateStageTargetId}
                                onClick={async () => {
                                  const res = await execute(
                                    {
                                      kind: "stage.delete",
                                      typeId: activeType.id,
                                      id: stage.id,
                                      targetId: migrateStageTargetId,
                                      expectedRevision: state.revision,
                                    },
                                    { successMessage: `已删除阶段并完成事项迁移` },
                                  );
                                  if (res.ok) setDeletingStageId(null);
                                }}
                              >
                                迁移并删除
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setDeletingStageId(null)}
                              >
                                取消
                              </Button>
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ol>

                <form
                  className="bd-flex bd-gap-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!addingStageName.trim()) return;
                    const res = await execute(
                      {
                        kind: "stage.add",
                        typeId: activeType.id,
                        name: addingStageName.trim(),
                        expectedRevision: state.revision,
                      },
                      { successMessage: `已添加阶段「${addingStageName.trim()}」` },
                    );
                    if (res.ok) setAddingStageName("");
                  }}
                >
                  <Input
                    aria-label="新增阶段名称"
                    placeholder="输入新阶段名称，按回车添加…"
                    value={addingStageName}
                    maxLength={120}
                    onChange={(e) => setAddingStageName(e.target.value)}
                    className="bd-h-8 bd-flex-1 bd-text-xs"
                  />
                  <Button
                    size="sm"
                    type="submit"
                    variant="outline"
                    disabled={!addingStageName.trim()}
                  >
                    <Icon name="plus" />
                    添加阶段
                  </Button>
                </form>
              </section>

              <section
                className="bd-space-y-2.5 bd-border-t bd-border-border bd-pt-4"
                aria-label="推进文档模板"
              >
                <div className="bd-flex bd-flex-wrap bd-items-center bd-justify-between bd-gap-2">
                  <div>
                    <Label htmlFor="budde-type-doc-template">推进文档模板（Markdown）</Label>
                    <FieldHelp>
                      支持 {"{{title}}"}、{"{{description}}"}、{"{{nextStep}}"}、{"{{date}}"}；模板中的二级标题（{"## 阶段名"}）在新建文档后会自动匹配并挂载到对应阶段。
                    </FieldHelp>
                  </div>
                  {notes.readDocMarkdown && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPickingTemplateDoc((v) => !v)}
                    >
                      <Icon name="note" />
                      {pickingTemplateDoc ? "收起文档提取" : "从思源文档提取…"}
                    </Button>
                  )}
                </div>

                {pickingTemplateDoc && notes.readDocMarkdown && (
                  <div className="bd-space-y-2 bd-rounded-md bd-border bd-border-border bd-bg-muted/30 bd-p-2.5">
                    <Input
                      value={templateDocQuery}
                      placeholder="搜索思源文档以载入其 Markdown 内容作为模板…"
                      aria-label="搜索思源模板文档"
                      onChange={(e) => setTemplateDocQuery(e.target.value)}
                      className="bd-h-8 bd-text-xs"
                    />
                    <div className="bd-max-h-36 bd-space-y-1 bd-overflow-y-auto">
                      {templateDocResults.map((hit) => (
                        <button
                          key={hit.id}
                          type="button"
                          disabled={loadingTemplateDoc}
                          onClick={async () => {
                            if (!notes.readDocMarkdown) return;
                            setLoadingTemplateDoc(true);
                            try {
                              const doc = await notes.readDocMarkdown(hit.id);
                              setTemplateDraft(doc.markdown);
                              setPickingTemplateDoc(false);
                              toast(
                                `已载入「${hit.title}」，点击「保存模板」生效`,
                                "success",
                              );
                            } catch (err) {
                              toast(
                                err instanceof Error ? err.message : "读取文档失败",
                                "error",
                              );
                            } finally {
                              setLoadingTemplateDoc(false);
                            }
                          }}
                          className="bd-flex bd-w-full bd-items-center bd-justify-between bd-gap-2 bd-rounded bd-px-2 bd-py-1.5 bd-text-left bd-text-xs hover:bd-bg-muted"
                        >
                          <span className="bd-truncate bd-font-medium">{hit.title}</span>
                          {hit.hpath && (
                            <span className="bd-truncate bd-text-[11px] bd-text-muted-foreground">
                              {hit.hpath}
                            </span>
                          )}
                        </button>
                      ))}
                      {templateDocResults.length === 0 && (
                        <p className="bd-px-2 bd-py-1 bd-text-xs bd-text-muted-foreground">
                          没有匹配的思源文档
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <Textarea
                  id="budde-type-doc-template"
                  rows={6}
                  value={templateDraft}
                  placeholder="# {{title}}&#10;&#10;## 背景与目标&#10;{{description}}"
                  onChange={(e) => setTemplateDraft(e.target.value)}
                  className="bd-font-mono bd-text-xs"
                />
                <div className="bd-flex bd-flex-wrap bd-items-center bd-justify-end bd-gap-2">
                  {templateDraft !== (activeType.docTemplate ?? "") && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setTemplateDraft(activeType.docTemplate ?? "")}
                    >
                      恢复原内容
                    </Button>
                  )}
                  {(activeType.docTemplate || templateDraft) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        setTemplateDraft("");
                        await execute(
                          {
                            kind: "type.update",
                            id: activeType.id,
                            name: activeType.name,
                            docTemplate: null,
                            expectedRevision: state.revision,
                          },
                          { successMessage: "已清空推进文档模板" },
                        );
                      }}
                    >
                      清空模板
                    </Button>
                  )}
                  <Button
                    size="sm"
                    disabled={templateDraft === (activeType.docTemplate ?? "")}
                    onClick={() => {
                      void execute(
                        {
                          kind: "type.update",
                          id: activeType.id,
                          name: activeType.name,
                          docTemplate: templateDraft.trim() ? templateDraft : null,
                          expectedRevision: state.revision,
                        },
                        { successMessage: "推进文档模板已保存" },
                      );
                    }}
                  >
                    保存模板
                  </Button>
                </div>
              </section>

              <section className="bd-border-t bd-border-border bd-pt-4" aria-label="危险操作">
                {!confirmingDeleteType ? (
                  <div className="bd-flex bd-items-center bd-justify-between bd-gap-2">
                    <span className="bd-text-xs bd-text-muted-foreground">
                      该类型当前关联 {referencedItems.length} 个事项（含归档）
                    </span>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={state.types.length <= 1}
                      onClick={() => setConfirmingDeleteType(true)}
                    >
                      <Icon name="trash" />
                      删除此类型…
                    </Button>
                  </div>
                ) : (
                  <div className="bd-space-y-2.5 bd-rounded-md bd-border bd-border-destructive/35 bd-bg-destructive/5 bd-p-3 bd-text-xs">
                    {referencedItems.length > 0 ? (
                      <>
                        <p className="bd-leading-5 bd-text-foreground">
                          「{activeType.name}」下共有 <strong>{referencedItems.length}</strong>{" "}
                          个事项（含归档）。请选择迁移的目标类型，删除时将自动迁移所有事项：
                        </p>
                        <div className="bd-flex bd-flex-wrap bd-items-center bd-gap-2">
                          <NativeSelect
                            aria-label="迁移目标类型"
                            value={migrateTypeTargetId}
                            onChange={(e) => setMigrateTypeTargetId(e.target.value)}
                            className="bd-h-8 bd-w-44 bd-text-xs"
                          >
                            {state.types
                              .filter((t) => t.id !== activeType.id)
                              .map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.name}
                                </option>
                              ))}
                          </NativeSelect>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={!migrateTypeTargetId}
                            onClick={async () => {
                              const res = await execute(
                                {
                                  kind: "type.delete",
                                  id: activeType.id,
                                  targetTypeId: migrateTypeTargetId,
                                  expectedRevision: state.revision,
                                },
                                {
                                  successMessage: `已迁移 ${referencedItems.length} 个事项并删除类型「${activeType.name}」`,
                                },
                              );
                              if (res.ok) setConfirmingDeleteType(false);
                            }}
                          >
                            确认迁移并删除类型
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setConfirmingDeleteType(false)}
                          >
                            取消
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="bd-flex bd-flex-wrap bd-items-center bd-justify-between bd-gap-2">
                        <span>确认删除空类型「{activeType.name}」？</span>
                        <div className="bd-flex bd-gap-2">
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={async () => {
                              const res = await execute(
                                {
                                  kind: "type.delete",
                                  id: activeType.id,
                                  expectedRevision: state.revision,
                                },
                                { successMessage: `已删除类型「${activeType.name}」` },
                              );
                              if (res.ok) setConfirmingDeleteType(false);
                            }}
                          >
                            确认删除
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setConfirmingDeleteType(false)}
                          >
                            取消
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
