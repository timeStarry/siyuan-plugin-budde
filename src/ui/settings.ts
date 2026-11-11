import type { BuddeClient, BuddeState, Command } from "../core/types";
import { choose, fitDialog } from "./dialog";
import { createElement as h } from "react";
import { query } from "./dom";
import { renderView, destroyView } from "./react-renderer";
import { SettingsView } from "./settings-view";

type Operation = "type.create" | "type.update" | "type.delete" | "stage.add" | "stage.update" | "stage.delete";
interface Values { name: string; initialStageId: string; completed: boolean; targetId: string }
export interface Editor { kind: Operation; id: string; values: Values; base: string }
interface SettingsOptions { client: BuddeClient; onSaved(state: BuddeState): void; onClosed(): void; confirmDiscard(): Promise<boolean> }

export function mountSettings(dialog: HTMLDialogElement, options: SettingsOptions) {
  const events = new AbortController();
  const root = dialog.closest<HTMLElement>(".budde")!;
  let destroyed = false;
  let opening = false;
  let release = () => {};
  let state: BuddeState;
  let active = "software";
  let editor: Editor | undefined; let renderId = 0;
  let busy = false;
  let guarding = false;
  let error = "";
  let conflict = false;
  const $ = <T extends HTMLElement = HTMLElement>(selector: string) => query<T>(dialog, selector);
  const dirty = () => !!editor && JSON.stringify(editor.values) !== editor.base;
  const current = () => state.types.find((type) => type.id === active)!;
  function status(): void {
    if (destroyed || !dialog.childElementCount) return;
    dialog.setAttribute("aria-busy", String(busy));
    $("#settings-status").textContent = busy ? "保存中…" : conflict ? "配置版本已变化" : dirty() ? "未保存" : "已载入";
    $("#settings-error").textContent = error;
    $("#settings-error").hidden = !error;
    $<HTMLFieldSetElement>("#settings-controls").disabled = busy;
    $<HTMLButtonElement>('[data-settings-action="close"]').disabled = busy;
    $<HTMLButtonElement>('[data-settings-action="reload"]').disabled = busy;
  }
  function focusKey(): string {
    const node = document.activeElement as HTMLElement | null;
    if (!node || !dialog.contains(node)) return "";
    if (node.dataset.part) return `[data-part="${CSS.escape(node.dataset.part)}"]`;
    if (node.dataset.settingsType) return `[data-settings-type="${CSS.escape(node.dataset.settingsType)}"]`;
    if (node.dataset.settingsAction) return `[data-settings-action="${CSS.escape(node.dataset.settingsAction)}"]${node.dataset.id ? `[data-id="${CSS.escape(node.dataset.id)}"]` : ""}`;
    if (node.dataset.editorField) return `[data-editor-field="${CSS.escape(node.dataset.editorField)}"]`;
    return node.matches('[data-part="settings-form"] button[type="submit"]') ? '[data-part="settings-form"] button[type="submit"]' : "";
  }
  function restoreFocus(key: string): void {
    if (!dialog.open) return;
    let target = key ? dialog.querySelector<HTMLElement>(key) : null;
    if (target?.matches(":disabled")) target = target.closest("[data-stage-row]")?.querySelector<HTMLElement>("button:not(:disabled)") ?? null;
    (target ?? dialog.querySelector<HTMLElement>(`[data-settings-type="${CSS.escape(active)}"]`))?.focus();
  }
  function render(): void {
    if (destroyed) return;
    const focus = focusKey();
    if (!state.types.some((type) => type.id === active)) active = state.types[0].id;
    renderView(dialog, h(SettingsView, { key: ++renderId, state, active, editor }));
    status();
    if (!busy) restoreFocus(focus);
  }
  async function commit(command: Command): Promise<boolean> {
    if (busy) return false;
    const focus = focusKey();
    busy = true; error = ""; conflict = false; status();
    try {
      const result = await options.client.execute(command);
      if (destroyed) return false;
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
    } finally { busy = false; status(); restoreFocus(focus); }
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
    if (destroyed || busy || guarding) return false;
    if (!dirty()) return true;
    guarding = true;
    const deletion = editor!.kind.endsWith("delete");
    const answer = await choose(root, deletion ? "放弃未执行的删除方案？" : "保存设置修改？", deletion ? "删除只会在点击确认删除时执行；这里可以保留方案继续设置，或放弃方案。" : "当前表单尚未提交。保存失败时不会关闭，也不会切换到其他设置项。", [
      ...(!deletion ? [{ value: "save", label: "保存后继续", primary: true }] : []),
      { value: "discard", label: deletion ? "放弃方案" : "放弃修改" }, { value: "cancel", label: "继续编辑" },
    ], "cancel");
    guarding = false;
    if (destroyed) return false;
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
    editor = undefined; release(); dialog.close(); options.onClosed();
    return true;
  }
  async function reload(): Promise<void> {
    if (busy || guarding) return;
    guarding = true;
    const confirmed = await options.confirmDiscard();
    guarding = false;
    if (!confirmed || destroyed) return;
    busy = true; status();
    try { state = await options.client.snapshot(); if (destroyed) return; editor = undefined; error = ""; conflict = false; render(); options.onSaved(state); }
    catch (cause) { error = cause instanceof Error ? cause.message : String(cause); }
    finally { busy = false; status(); restoreFocus('[data-settings-action="reload"]'); }
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
      if (destroyed || opening || dialog.open) return;
      opening = true;
      try {
        const latest = await options.client.snapshot();
        if (destroyed) return;
        state = latest; editor = undefined; error = ""; conflict = false;
        render(); release = fitDialog(dialog);
        dialog.querySelector<HTMLElement>(`[data-settings-type="${CSS.escape(active)}"]`)?.focus();
      } finally { opening = false; }
    }, requestClose,
    destroy(): void { destroyed = true; release(); events.abort(); if (dialog.open) dialog.close(); destroyView(dialog); dialog.replaceChildren(); },
  };
}
