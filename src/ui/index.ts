import type { BuddeClient, BuddeState, Command, ItemPatch, NoteBridge } from "../core/types";
import { CaptureRequest, selectItems, type Filters, type View } from "./model";
import { createElement as h } from "react";
import { CollectionView } from "./collection-view";
import { WorkbenchView, MainNavView, TypeIndexView, TypeOptions } from "./workbench-view";
import { renderView, destroyViews } from "./react-renderer";
import { query } from "./dom";
import { mountDetail } from "./detail";
import { choose } from "./dialog";
import { mountSettings } from "./settings";

export function mountWorkbench(root: HTMLElement, client: BuddeClient, notes: NoteBridge): { refresh(): Promise<void>; destroy(): void } {
  let state: BuddeState | undefined; let view: View = "pool"; let boardType = ""; let captureType = ""; let selected = "";
  let destroyed = false; let capturing = false; let composing = false; let refreshing = false; let configuring = false;
  const filters: Filters = { query: "", typeId: "", unpromotedOnly: false };
  const request = new CaptureRequest(); const events = new AbortController(); const mutating = new Set<string>();
  root.classList.add("budde", "workbench"); root.dataset.instance = `budde-${crypto.randomUUID()}`;
  renderView(root, h(WorkbenchView));
  const $ = <T extends HTMLElement = HTMLElement>(selector: string) => query<T>(root, selector);
  const captureInput = $<HTMLInputElement>("#capture-title"); const createType = $<HTMLSelectElement>("#create-type");
  const search = $<HTMLInputElement>("#title-search"); const filterType = $<HTMLSelectElement>("#filter-type"); const collection = $("#collection");
  function notify(message: string, error = false) { if (destroyed) return; $("#error").hidden = !error; $("#error").textContent = error ? message : ""; $("#notice").textContent = error ? "" : message; }
  function adopt(next: BuddeState) { if (destroyed || (state && next.revision < state.revision)) return; state = next; render(); }
  let hudTimer: ReturnType<typeof setTimeout> | undefined;
  function success(message: string) {
    if (destroyed) return;
    clearTimeout(hudTimer); $("#success-message").textContent = message; $("#success-hud").hidden = false;
    hudTimer = setTimeout(() => { if (!destroyed) { $("#success-hud").hidden = true; $("#success-message").textContent = ""; } }, 2200);
  }
  const detail = mountDetail($("#detail-host"), { client, notes, onSaved: adopt, onSuccess: success, onClosed() { selected = ""; render(); } });
  let settingsOpener: HTMLElement | null = null;
  const settings = mountSettings($<HTMLDialogElement>("#settings-dialog"), { client, onSaved: adopt, onClosed() { if (!destroyed && settingsOpener?.isConnected && root.contains(settingsOpener)) settingsOpener.focus(); }, async confirmDiscard() { return await choose(root, "放弃设置草稿并读取最新配置？", "未保存的设置输入会被丢弃，不覆盖已经提交的配置。", [{ value: "reload", label: "放弃并读取" }, { value: "cancel", label: "继续编辑" }]) === "reload"; } });
  function render() {
    if (destroyed || !state) return;
    const latest = state;
    if (!latest.types.some(type => type.id === boardType)) boardType = latest.types[0].id;
    if (!latest.types.some(type => type.id === captureType)) captureType = latest.types.find(type => type.id === "general")?.id ?? latest.types[0].id;
    if (!latest.types.some(type => type.id === filters.typeId)) filters.typeId = "";
    renderView(createType, h(TypeOptions, { state: latest })); createType.value = captureType;
    renderView(filterType, h(TypeOptions, { state: latest, all: true })); filterType.value = filters.typeId; filterType.hidden = view === "board";
    search.value = filters.query;
    renderView($("#main-nav"), h(MainNavView, { view }));
    root.querySelectorAll<HTMLButtonElement>("header [data-view]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.view === view)));
    $("#pool-modes").hidden = view !== "pool";
    root.querySelectorAll<HTMLButtonElement>("[data-pool]").forEach(button => button.setAttribute("aria-pressed", String((button.dataset.pool === "unpromoted") === filters.unpromotedOnly)));
    const current = { ...filters, typeId: view === "board" ? boardType : filters.typeId };
    const type = latest.types.find(entry => entry.id === boardType)!;
    $("h1").textContent = view === "board" ? type.name : ({ pool: "想法池", active: "正在推进", archive: "归档" })[view];
    $("#result-count").textContent = `${selectItems(latest, view, current).length} 个事项`;
    $("#type-index").hidden = view !== "board"; $("#board-hint").hidden = view !== "board";
    renderView($("#type-index"), h(TypeIndexView, { state: latest, boardType, filters }));
    const position = { top: collection.scrollTop, left: collection.scrollLeft };
    collection.dataset.collectionView = view;
    renderView(collection, h(CollectionView, { state: latest, view, filters: current, selected, onMove(id, stageId) {
      const item = state?.items.find(entry => entry.id === id);
      if (!item || item.typeId !== boardType || item.archived || !item.promoted) return;
      return run(() => mutate(id, { stageId }));
    }, async onAddStage(name) { await configure({ kind: 'stage.add', typeId: type.id, name, expectedRevision: latest.revision }); } }));
    collection.scrollTop = position.top; collection.scrollLeft = position.left;
    detail.refresh(latest);
    const hidden = $("#selected-hidden"); if (hidden) hidden.hidden = selectItems(latest, view, current).some(item => item.id === selected);
    $("#capture").querySelectorAll<HTMLInputElement | HTMLButtonElement>("input,button,select").forEach(control => control.disabled = capturing);
  }
  async function refresh() {
    if (destroyed || refreshing) return; refreshing = true;
    try { const next = await client.snapshot(); if (!destroyed && (!state || next.revision > state.revision)) { const initial = !state; adopt(next); if (initial) notify(""); } }
    catch (cause) { notify(cause instanceof Error ? cause.message : String(cause), true); }
    finally { refreshing = false; }
  }
  async function configure(command: Extract<Command, { kind: 'stage.add' | 'stage.update' | 'stage.reorder' }>) {
    if (destroyed) return;
    if (configuring) throw new Error('配置正在保存，请稍候。');
    configuring = true;
    try { const result = await client.execute(command); if (!destroyed) { adopt(result.state); notify('阶段配置已保存。'); } }
    finally { configuring = false; }
  }
  function run(task: () => Promise<void>) { if (destroyed) return; return task().catch(cause => notify(cause instanceof Error ? cause.message : String(cause), true)); }
  async function mutate(id: string, patch: ItemPatch) {
    if (destroyed || mutating.has(id) || !state) return;
    if (id === selected) { await detail.apply(patch, patch.stageId ? "改变阶段" : "开始推进"); return; }
    const item = state.items.find(entry => entry.id === id); if (!item) return;
    mutating.add(id); root.querySelectorAll<HTMLButtonElement>(`[data-promote="${CSS.escape(id)}"],[data-stage-item="${CSS.escape(id)}"]`).forEach(button => button.disabled = true);
    try { const result = await client.execute({ kind: "item.update", id, expectedVersion: item.version, patch }); adopt(result.state); notify(patch.stageId ? "阶段已更新。" : "已开始推进，原阶段不变。"); }
    finally { mutating.delete(id); if (!destroyed) render(); }
  }
  const listen = (name: string, callback: EventListener, capture = false) => root.addEventListener(name, callback, { signal: events.signal, capture });
  listen("submit", ((event: SubmitEvent) => {
    if (event.target !== $("#capture")) return; event.preventDefault(); if (!state || capturing || composing) return;
    capturing = true; const form = $("#capture"); form.setAttribute("aria-busy", "true"); form.querySelectorAll<HTMLInputElement | HTMLButtonElement>("input,select,button").forEach(control => control.disabled = true);
    run(async () => { try { const result = await client.execute(request.prepare(captureInput.value, captureType)); if (destroyed) return; request.success(); captureInput.value = ""; adopt(result.state); notify("已记入想法池，尚未开始推进。继续记录下一条吧。"); } finally { capturing = false; if (!destroyed) { form.setAttribute("aria-busy", "false"); form.querySelectorAll<HTMLInputElement | HTMLButtonElement>("input,select,button").forEach(control => control.disabled = false); captureInput.focus(); } } });
  }) as EventListener);
  listen("compositionstart", (() => composing = true) as EventListener); listen("compositionend", (() => composing = false) as EventListener);
  listen("keydown", ((event: KeyboardEvent) => {
    const ime = composing || event.isComposing || event.keyCode === 229;
    if (event.target === captureInput && event.key === "Enter" && ime) event.preventDefault();
    const target = event.target instanceof Element ? event.target : null;
    if (event.defaultPrevented || ime || event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || event.key.toLowerCase() !== "c" || !target || target.closest('.budde') !== root) return;
    if (target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="menu"]') || root.querySelector('dialog[open],[role="dialog"][aria-modal="true"],[role="menu"]') || captureInput.disabled || capturing) return;
    event.preventDefault();
    run(async () => { if (await detail.requestClose() && !destroyed && root.contains(root.ownerDocument.activeElement)) captureInput.focus(); });
  }) as EventListener);
  listen("input", ((event: Event) => { if (event.target === search) { filters.query = search.value; render(); } }) as EventListener);
  listen("change", ((event: Event) => { if (event.target === createType) captureType = createType.value; if (event.target === filterType) { filters.typeId = filterType.value; render(); } }) as EventListener);
  listen("click", ((event: MouseEvent) => {
    const target = event.target as Element;
    const button = target.closest<HTMLElement>("button"); if (!button || !root.contains(button) || !state) return;
    if (button.dataset.view && button.dataset.view !== view) run(async () => { if (await detail.requestClose() && !destroyed) { view = button.dataset.view as View; render(); } });
    if (button.dataset.boardType && button.dataset.boardType !== boardType) run(async () => { if (await detail.requestClose() && !destroyed) { boardType = button.dataset.boardType!; render(); } });
    if (button.dataset.pool) { filters.unpromotedOnly = button.dataset.pool === "unpromoted"; render(); }
    if (button.dataset.open) run(async () => { const item = state!.items.find(entry => entry.id === button.dataset.open); if (item && await detail.open(item, state!) && !destroyed) { selected = item.id; render(); } });
    if (button.dataset.promote) run(() => mutate(button.dataset.promote!, { promoted: true }));
    if (button.dataset.stageItem) run(() => mutate(button.dataset.stageItem!, { stageId: button.dataset.stageTarget }));
    if (button.dataset.action === 'type.create' || button.dataset.action === 'type.settings' || button.dataset.action === 'stage.settings') run(async () => {
      const owner = button.closest<HTMLElement>('[data-menu-owner]')?.dataset.menuOwner;
      const opener = owner ? root.querySelector<HTMLElement>(`[data-menu-id="${CSS.escape(owner)}"]`) ?? button : button;
      const target = button.dataset.action === 'type.create' ? { kind: 'type.create' as const } : button.dataset.action === 'type.settings' ? { kind: 'type.update' as const, typeId: button.dataset.typeId } : { kind: button.dataset.operation === 'delete' ? 'stage.delete' as const : 'stage.update' as const, typeId: button.dataset.typeId, id: button.dataset.stageId };
      if (await detail.requestClose() && !destroyed) { settingsOpener = opener; await settings.open(target); }
    });
    if (button.dataset.stageCommand) run(async () => {
      const type = state!.types.find(type => type.id === button.dataset.typeId);
      const stage = type?.stages.find(stage => stage.id === button.dataset.stageId);
      if (!type || !stage) return;
      const expectedRevision = state!.revision;
      if (button.dataset.stageCommand === 'toggle') await configure({ kind: 'stage.update', typeId: type.id, id: stage.id, name: stage.name, completed: !stage.completed, expectedRevision });
      else { const ids = type.stages.map(stage => stage.id), index = ids.indexOf(stage.id), next = index + (button.dataset.stageCommand === 'left' ? -1 : 1); if (next < 0 || next >= ids.length) return; [ids[index], ids[next]] = [ids[next], ids[index]]; await configure({ kind: 'stage.reorder', typeId: type.id, ids, expectedRevision }); }
    });
    if (button.dataset.action === "refresh") void refresh();
    if (button.dataset.action === "export") run(async () => { const data = await client.exportData(); if (destroyed) return; const url = URL.createObjectURL(new Blob([data], { type: "application/json" })); const link = document.createElement("a"); link.href = url; link.download = "budde.json"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 0); notify("已导出 JSON，不包含思源笔记正文。"); });
    if (button.dataset.action === "focus-capture") captureInput.focus();
    if (button.dataset.action === "clear-filters") { filters.query = ""; filters.typeId = ""; filters.unpromotedOnly = false; render(); search.focus(); }
  // Read delegated commands before Radix can unmount a selected portal item.
  }) as EventListener, true);
  void refresh();
  return { refresh, destroy() { if (destroyed) return; destroyed = true; clearTimeout(hudTimer); root.querySelectorAll<HTMLDialogElement>(".guard-dialog[open]").forEach(dialog => dialog.close()); settings.destroy(); detail.destroy(); events.abort(); destroyViews(root); root.replaceChildren(); root.classList.remove("budde", "workbench"); delete root.dataset.instance; } };
}
