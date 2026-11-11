import type { BuddeClient, BuddeState, Command } from "../../src/core/types";
import { choose } from "./dialog";
import { escape } from "./view";

type Operation = "type.create" | "type.update" | "type.delete" | "stage.add" | "stage.update" | "stage.delete";
interface Values { name: string; initialStageId: string; completed: boolean; targetId: string }
interface Editor { kind: Operation; id: string; values: Values; base: string }
interface SettingsOptions { client: BuddeClient; onSaved(state: BuddeState): void; onClosed(): void; confirmDiscard(): Promise<boolean> }

export function mountSettings(dialog: HTMLDialogElement, options: SettingsOptions) {
  const events = new AbortController();
  let state: BuddeState;
  let active = "software";
  let editor: Editor | undefined;
  let busy = false;
  let guarding = false;
  let error = "";
  let conflict = false;
  const $ = <T extends HTMLElement = HTMLElement>(selector: string) => dialog.querySelector<T>(selector)!;
  const dirty = () => !!editor && JSON.stringify(editor.values) !== editor.base;
  const current = () => state.types.find((type) => type.id === active)!;
  function status(): void {
    if (!dialog.childElementCount) return;
    $("#settings-status").textContent = busy ? "保存中…" : conflict ? "配置版本已变化" : dirty() ? "未保存" : "已载入";
    $("#settings-error").textContent = error;
    $("#settings-error").hidden = !error;
    $<HTMLFieldSetElement>("#settings-controls").disabled = busy;
    $<HTMLButtonElement>('[data-settings-action="close"]').disabled = busy;
    $<HTMLButtonElement>('[data-settings-action="reload"]').disabled = busy;
  }
  function editorMarkup(): string {
    if (!editor) return '<p class="settings-idle">选择一个设置项编辑。每次只提交当前表单，避免把其他输入一并保存。</p>';
    const type = current();
    const values = editor.values;
    const deleting = editor.kind.endsWith("delete");
    const typeOperation = editor.kind.startsWith("type.");
    const label = ({ "type.create": "新建类型", "type.update": "编辑类型", "type.delete": "删除类型", "stage.add": "新增阶段", "stage.update": "编辑阶段", "stage.delete": "删除阶段" })[editor.kind];
    const stage = type.stages.find((entry) => entry.id === editor!.id);
    const affected = state.items.filter((item) => item.typeId === type.id && (typeOperation || item.stageId === editor!.id));
    const archived = affected.filter((item) => item.archived).length;
    const blocked = editor.kind === "type.delete" && (affected.length > 0 || state.types.length === 1);
    return `<form id="settings-form" novalidate><h3>${label}${stage ? ` · ${escape(stage.name)}` : ""}</h3>
      ${!deleting ? `<label for="setting-name">${typeOperation ? "类型名称" : "阶段名称"}</label><input id="setting-name" data-editor-field="name" value="${escape(values.name)}" autocomplete="off">` : ""}
      ${editor.kind === "type.update" ? `<label for="setting-initial">初始阶段</label><select id="setting-initial" data-editor-field="initialStageId">${type.stages.map((entry) => `<option value="${escape(entry.id)}" ${entry.id === values.initialStageId ? "selected" : ""}>${escape(entry.name)}</option>`).join("")}</select><p class="field-help">仅改变之后新建事项的落点，不移动已有事项。</p>` : ""}
      ${editor.kind === "stage.update" ? `<label class="checkbox-label"><input type="checkbox" data-editor-field="completed" ${values.completed ? "checked" : ""}>完成阶段</label><p class="field-help">完成由此标记决定，与阶段顺序无关。改变标记会改变该阶段事项的集合归属。</p>` : ""}
      ${deleting ? `<p id="migration-impact" class="context-note">涉及 ${affected.length} 个事项，其中 ${archived} 个归档。${typeOperation ? affected.length ? "类型仍被引用，不能删除；请先在事项详情迁移所有引用。" : state.types.length === 1 ? "至少保留一种类型。" : "此类型未被引用，可以删除。" : `${type.initialStageId === editor.id ? "这也是初始阶段，删除时初始落点一并切换。" : ""}迁移包含归档事项；相关事项的版本会更新，暂停与归档状态保持不变。`}</p>` : ""}
      ${editor.kind === "stage.delete" ? `<label for="setting-target">迁移目标阶段</label><select id="setting-target" data-editor-field="targetId"><option value="">请选择迁移目标</option>${type.stages.filter((entry) => entry.id !== editor!.id).map((entry) => `<option value="${escape(entry.id)}" ${entry.id === values.targetId ? "selected" : ""}>${escape(entry.name)}</option>`).join("")}</select>` : ""}
      <div class="setting-form-actions"><button type="submit" class="${deleting ? "danger-button" : "primary"}" ${blocked ? "disabled" : ""}>${deleting ? typeOperation ? "确认删除类型" : "确认删除并迁移" : "保存设置"}</button><button type="button" data-settings-action="cancel-editor">取消编辑</button></div></form>`;
  }
  function render(): void {
    if (!state.types.some((type) => type.id === active)) active = state.types[0].id;
    const type = current();
    dialog.innerHTML = `<div class="settings-header"><div><h2>管理类型与阶段</h2><p class="field-help">载入版本 ${state.revision} · <span id="settings-status" role="status"></span></p></div><div><button data-settings-action="reload">重新读取设置</button><button class="icon-button" data-settings-action="close" aria-label="关闭设置">×</button></div></div>
      <fieldset id="settings-controls" class="settings-body"><aside class="settings-types" aria-label="类型列表">${state.types.map((entry) => `<button data-settings-type="${escape(entry.id)}" aria-pressed="${entry.id === active}">${escape(entry.name)}</button>`).join("")}<button class="new-type" data-settings-action="type.create"><span aria-hidden="true">＋</span> 新建类型</button></aside>
      <section class="settings-content"><div class="settings-type-heading"><h3>${escape(type.name)}</h3><button data-settings-action="type.update">编辑类型</button><button class="quiet" data-settings-action="type.delete">删除类型</button></div><p class="field-help">初始阶段控制新建落点；完成标记与排列位置无关。</p>
      <ol class="stage-list">${type.stages.map((stage, index) => `<li data-stage-row="${escape(stage.id)}"><div class="stage-description"><span>${escape(stage.name)}</span><small>${stage.id === type.initialStageId ? "初始阶段" : ""}${stage.id === type.initialStageId && stage.completed ? " · " : ""}${stage.completed ? "完成阶段" : ""}</small></div><div class="stage-controls"><button class="icon-button" data-settings-action="up" data-id="${escape(stage.id)}" aria-label="上移阶段：${escape(stage.name)}" ${index === 0 ? "disabled" : ""}>↑</button><button class="icon-button" data-settings-action="down" data-id="${escape(stage.id)}" aria-label="下移阶段：${escape(stage.name)}" ${index === type.stages.length - 1 ? "disabled" : ""}>↓</button><button data-settings-action="stage.update" data-id="${escape(stage.id)}">编辑</button><button data-settings-action="stage.delete" data-id="${escape(stage.id)}" ${type.stages.length === 1 ? "disabled" : ""}>删除</button></div></li>`).join("")}</ol><button data-settings-action="stage.add"><span aria-hidden="true">＋</span> 新增阶段</button><div id="settings-editor">${editorMarkup()}</div><div id="settings-error" role="alert" hidden></div></section></fieldset>`;
    status();
  }
  async function commit(command: Command): Promise<boolean> {
    if (busy) return false;
    busy = true; error = ""; conflict = false; status();
    try {
      const result = await options.client.execute(command);
      state = result.state;
      if (command.kind === "type.create") active = state.types.at(-1)!.id;
      editor = undefined;
      render();
      options.onSaved(state);
      return true;
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
      conflict = typeof cause === "object" && cause !== null && "code" in cause && cause.code === "CONFLICT";
      return false;
    } finally { busy = false; status(); }
  }
  async function save(): Promise<boolean> {
    if (!editor) return true;
    const { kind, id, values } = editor;
    const expectedRevision = state.revision;
    if (kind === "type.create") return commit({ kind, expectedRevision, name: values.name });
    if (kind === "type.update") return commit({ kind, expectedRevision, id: active, name: values.name, initialStageId: values.initialStageId });
    if (kind === "type.delete") return commit({ kind, expectedRevision, id: active });
    if (kind === "stage.add") return commit({ kind, expectedRevision, typeId: active, name: values.name });
    if (kind === "stage.update") return commit({ kind, expectedRevision, typeId: active, id, name: values.name, completed: values.completed });
    return commit({ kind, expectedRevision, typeId: active, id, targetId: values.targetId || undefined });
  }
  async function resolveEditor(): Promise<boolean> {
    if (busy || guarding) return false;
    if (!dirty()) return true;
    guarding = true;
    const deletion = editor!.kind.endsWith("delete");
    const answer = await choose(deletion ? "放弃未执行的删除方案？" : "保存设置修改？", deletion ? "删除只会在点击确认删除时执行；这里可以保留方案继续设置，或放弃方案。" : "当前表单尚未提交。保存失败时不会关闭，也不会切换到其他设置项。", [
      ...(!deletion ? [{ value: "save", label: "保存后继续", primary: true }] : []),
      { value: "discard", label: deletion ? "放弃方案" : "放弃修改" }, { value: "cancel", label: "继续编辑" },
    ], "cancel");
    guarding = false;
    if (answer === "cancel") return false;
    if (answer === "save") return save();
    editor = undefined; error = ""; conflict = false;
    return true;
  }
  async function start(kind: Operation, id = ""): Promise<void> {
    if (!await resolveEditor()) return;
    const type = current();
    const stage = type.stages.find((entry) => entry.id === id);
    const values = { name: kind === "type.update" ? type.name : kind === "stage.update" ? stage!.name : "", initialStageId: type.initialStageId, completed: stage?.completed ?? false, targetId: "" };
    editor = { kind, id, values, base: JSON.stringify(values) };
    error = ""; conflict = false; render();
    dialog.querySelector<HTMLElement>("[data-editor-field]")?.focus();
  }
  async function requestClose(): Promise<boolean> {
    if (!dialog.open) return true;
    if (!await resolveEditor()) return false;
    editor = undefined; dialog.close(); options.onClosed();
    return true;
  }
  async function reload(): Promise<void> {
    if (busy || guarding) return;
    guarding = true;
    const confirmed = await options.confirmDiscard();
    guarding = false;
    if (!confirmed) return;
    busy = true; status();
    try { state = await options.client.snapshot(); editor = undefined; error = ""; conflict = false; render(); options.onSaved(state); }
    catch (cause) { error = cause instanceof Error ? cause.message : String(cause); }
    finally { busy = false; status(); }
  }
  function edit(event: Event): void {
    const input = event.target as HTMLInputElement | HTMLSelectElement;
    const key = input.dataset.editorField as keyof Values | undefined;
    if (!editor || !key) return;
    if (key === "completed") editor.values.completed = (input as HTMLInputElement).checked;
    else editor.values[key] = input.value;
    if (!conflict) error = "";
    status();
  }
  dialog.addEventListener("input", edit, { signal: events.signal });
  dialog.addEventListener("change", edit, { signal: events.signal });
  dialog.addEventListener("cancel", (event) => { event.preventDefault(); void requestClose(); }, { signal: events.signal });
  dialog.addEventListener("submit", (event) => { event.preventDefault(); void save(); }, { signal: events.signal });
  dialog.addEventListener("click", (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>("button");
    if (!button || busy || guarding) return;
    if (button.dataset.settingsType) void (async () => { if (await resolveEditor()) { active = button.dataset.settingsType!; editor = undefined; error = ""; conflict = false; render(); } })();
    const action = button.dataset.settingsAction;
    if (action?.startsWith("type.") || action?.startsWith("stage.")) void start(action as Operation, button.dataset.id);
    if (action === "close") void requestClose();
    if (action === "reload") void reload();
    if (action === "cancel-editor") void (async () => { if (await resolveEditor()) { editor = undefined; error = ""; conflict = false; render(); } })();
    if (action === "up" || action === "down") void (async () => {
      if (!await resolveEditor()) return;
      const ids = current().stages.map((stage) => stage.id);
      const index = ids.indexOf(button.dataset.id!);
      const target = index + (action === "up" ? -1 : 1);
      if (index < 0 || target < 0 || target >= ids.length) return;
      [ids[index], ids[target]] = [ids[target], ids[index]];
      await commit({ kind: "stage.reorder", typeId: active, ids, expectedRevision: state.revision });
    })();
  }, { signal: events.signal });
  return {
    async open(): Promise<void> {
      if (dialog.open) return;
      state = await options.client.snapshot(); editor = undefined; error = ""; conflict = false;
      render(); dialog.showModal();
      dialog.querySelector<HTMLElement>(`[data-settings-type="${CSS.escape(active)}"]`)?.focus();
    }, requestClose,
    destroy(): void { events.abort(); if (dialog.open) dialog.close(); dialog.replaceChildren(); },
  };
}
