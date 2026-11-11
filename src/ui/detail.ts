import type { BuddeClient, BuddeState, Item, ItemPatch, NoteBridge } from "../core/types";
import { DraftSession } from "./draft";
import { choose } from "./dialog";
import { createElement as h } from "react";
import { query } from "./dom";
import { renderView, destroyView } from "./react-renderer";
import { DetailFrame, DetailView, NoteLinks, StageOptions } from "./detail-view";
interface DetailOptions { client: BuddeClient; notes: NoteBridge; onSaved(state: BuddeState): void; onClosed(): void }
export function mountDetail(container: HTMLElement, options: DetailOptions) {
  const root = container.closest<HTMLElement>(".budde")!;
  const events = new AbortController(); const draft = new DraftSession();
  const $ = <T extends HTMLElement = HTMLElement>(selector: string) => query<T>(container, selector);
  let state: BuddeState; let editing = false; let guarding = false; let resolving = false; let reloading = false; let destroyed = false; let error = "";
  let opener: HTMLElement | null = null; let openerId = ""; let modal = false; let renderedConfig = "";
  const background = () => root.querySelectorAll<HTMLElement>(".app-header,.capture-area,.main-panel");
  function layout() {
    if (destroyed) return;
    const nextModal = !!draft.item && root.clientWidth < 1200;
    const active = document.activeElement;
    const focusOwnBackground = nextModal && !!active && root.contains(active) && !container.contains(active) && !root.querySelector("dialog[open]");
    modal = nextModal;
    container.classList.toggle("is-overlay", modal); container.dataset.overlay = String(modal);
    // A guard/settings layer owns inert while it is open.
    if (!root.querySelector("dialog[open]")) background().forEach(node => node.inert = modal);
    const pane = container.querySelector<HTMLElement>(".detail-pane");
    if (pane) { pane.setAttribute("role", modal ? "dialog" : "region"); if (modal) pane.setAttribute("aria-modal", "true"); else pane.removeAttribute("aria-modal"); if (focusOwnBackground) pane.focus({ preventScroll: true }); }
  }
  const observer = new ResizeObserver(layout); observer.observe(root);
  root.addEventListener("budde:dialog-close", layout, { signal: events.signal });
  const blocked = () => destroyed || guarding || resolving || reloading || draft.status === "saving";
  function synchronizeRead(): boolean {
    if (!draft.item || editing || blocked()) return false;
    const item = state.items.find(entry => entry.id === draft.item!.id);
    const config = JSON.stringify(state.types.find(type => type.id === item?.typeId));
    if (!item || (item.version === draft.item.version && config === renderedConfig)) return false;
    // Compare against what was rendered, not snapshots deferred by a busy lock.
    // A read-mode action has no user draft to rebase; retain its failure feedback.
    const failure = { status: draft.status, error: draft.error };
    draft.discard(item);
    if (failure.status === "error" || failure.status === "conflict") Object.assign(draft, failure);
    render(); return true;
  }
  function status() {
    if (destroyed || !draft.item || !container.childElementCount) return;
    if (synchronizeRead()) return;
    $("#detail-status").textContent = reloading ? "读取最新版本中…" : resolving ? "验证笔记中…" : ({ saved: "已保存", dirty: "未保存", saving: "保存中…", error: "保存失败，输入已保留", conflict: "版本已变化，草稿已保留" })[draft.status];
    $("#detail-error").textContent = draft.error || error; $("#detail-error").hidden = !(draft.error || error);
    $("[data-detail-action=reload]").hidden = draft.status !== "conflict" && draft.status !== "error";
    const busy = resolving || reloading || draft.status === "saving";
    $<HTMLButtonElement>("[data-detail-action=reload]").disabled = busy;
    container.setAttribute("aria-busy", String(busy));
    container.querySelectorAll<HTMLFieldSetElement>("fieldset").forEach(node => node.disabled = busy);
    container.querySelectorAll<HTMLButtonElement>(".detail-heading button,.detail-footer button").forEach(button => button.disabled = busy);
  }
  function links() {
    if (!draft.item || destroyed) return;
    renderView($("#note-links"), h(NoteLinks, { item: draft.item, editing }));
  }
  function render() {
    if (destroyed) return;
    const item = draft.item;
    if (!item) { renderView(container, h(DetailFrame, { open: false })); layout(); return; }
    const type = state.types.find(entry => entry.id === item.typeId)!;
    renderedConfig = JSON.stringify(type);
    const active = container.contains(document.activeElement) ? document.activeElement as HTMLElement : null;
    const focusKey = active?.dataset.part ? `[data-part="${CSS.escape(active.dataset.part)}"]` : active?.dataset.detailAction ? `[data-detail-action="${CSS.escape(active.dataset.detailAction)}"]` : active?.dataset.noteOpen ? `[data-note-open="${CSS.escape(active.dataset.noteOpen)}"]` : active?.classList.contains("detail-pane") ? ".detail-pane" : "";
    const scroll = container.querySelector(".detail-body")?.scrollTop ?? 0;
    renderView(container, h(DetailFrame, { open: true }, h(DetailView, { key: item.id, state, item, editing })));
    links(); status(); layout();
    $(".detail-body").scrollTop = scroll;
    if (focusKey) container.querySelector<HTMLElement>(focusKey)?.focus({ preventScroll: true });
  }
  async function save(extra: ItemPatch = {}): Promise<boolean> {
    if (blocked()) return false;
    error = ""; const pending = draft.save(options.client, extra); status();
    try { const next = await pending; if (destroyed) return false; if (next.revision > state.revision) state = next; draft.discard(state.items.find(item => item.id === draft.item?.id)); editing = false; render(); options.onSaved(state); $(".detail-pane").focus(); return true; }
    catch { status(); return false; }
  }
  async function resolveDraft(): Promise<boolean> {
    if (blocked()) return false;
    if (!draft.dirty && draft.status !== "conflict" && draft.status !== "error") return true;
    guarding = true;
    const choice = await choose(root, "保存未完成的修改？", "保存失败不会离开；放弃只丢弃本地草稿，不覆盖其他窗口。", [{ value: "save", label: "保存后继续", primary: true }, { value: "discard", label: "放弃修改" }, { value: "cancel", label: "继续编辑" }]);
    guarding = false; status();
    if (destroyed || choice === "cancel") return false;
    return choice !== "save" || await save();
  }
  async function requestClose(): Promise<boolean> {
    if (!draft.item) return !destroyed;
    if (!await resolveDraft()) return false;
    const id = openerId; draft.select(); editing = false; error = ""; render(); options.onClosed();
    if (opener?.isConnected && root.contains(opener) && !opener.closest("[inert]")) opener.focus(); else root.querySelector<HTMLElement>(`[data-open="${CSS.escape(id)}"]`)?.focus();
    return true;
  }
  async function apply(patch: ItemPatch, label = "执行此操作") {
    if (blocked()) return;
    if (draft.dirty) {
      guarding = true;
      const choice = await choose(root, "保存修改并执行？", `将保存当前修改，并${label}。取消保留所有输入与原状态。`, [{ value: "save", label: "保存修改并执行", primary: true }, { value: "cancel", label: "取消" }]);
      guarding = false; status(); if (destroyed || choice !== "save") return;
    }
    await save(patch);
  }
  async function reload() {
    if (blocked()) return; guarding = true;
    const choice = await choose(root, "放弃本地草稿并读取最新版本？", "标题、下一步、说明和关联会被最新版本替换；不自动合并。", [{ value: "reload", label: "放弃并读取" }, { value: "cancel", label: "继续编辑" }]);
    guarding = false; status(); if (destroyed || choice !== "reload") return;
    const id = draft.item?.id; reloading = true; status();
    try { const latest = await options.client.snapshot(); if (destroyed || draft.item?.id !== id) return; if (latest.revision > state.revision) state = latest; draft.discard(state.items.find(item => item.id === id)); editing = false; error = ""; render(); options.onSaved(state); }
    catch (cause) { if (!destroyed) error = cause instanceof Error ? cause.message : String(cause); }
    finally { reloading = false; status(); }
  }
  container.addEventListener("input", event => {
    if (!editing || blocked()) return;
    const input = event.target as HTMLInputElement;
    const key = ({ "detail-title": "title", "detail-next": "nextStep", "detail-description": "description" } as const)[input.dataset.part as "detail-title"];
    if (key) { draft.edit({ [key]: input.value }); error = ""; status(); }
  }, { signal: events.signal });
  container.addEventListener("change", event => {
    if (!editing || blocked()) return; const select = event.target as HTMLSelectElement;
    if (select.dataset.part === "detail-type") { draft.edit({ typeId: select.value, stageId: "" }); renderView($("#detail-stage"), h(StageOptions, { state, typeId: select.value })); $<HTMLSelectElement>("#detail-stage").value = ""; }
    if (select.dataset.part === "detail-stage") draft.edit({ stageId: select.value }); status();
  }, { signal: events.signal });
  container.addEventListener("submit", event => { event.preventDefault(); void save(); }, { signal: events.signal });
  container.addEventListener("click", event => {
    if (event.target === container && modal) { void requestClose(); return; }
    const button = (event.target as Element).closest<HTMLButtonElement>("button"); if (!button || !draft.item || blocked()) return;
    const item = draft.item; const action = button.dataset.detailAction;
    if (action === "close") void requestClose();
    if (action === "edit") { editing = true; render(); $("#detail-title").focus(); }
    if (action === "cancel-edit") void (async () => { if (!await resolveDraft() || destroyed) return; draft.discard(state.items.find(entry => entry.id === item.id)); editing = false; error = ""; render(); $("[data-detail-action=edit]").focus(); })();
    if (action === "reload") void reload();
    if (action === "promote") void apply({ promoted: true }, "开始推进（阶段不变）");
    if (action === "pause") void apply({ paused: !item.paused }, item.paused ? "恢复推进" : "暂停");
    if (action === "archive") void apply({ archived: !item.archived }, item.archived ? "移出归档" : "归档");
    if (action === "review") void apply({ reviewedAt: new Date().toISOString() }, "确认已复查");
    if (action === "link") { $("#link-editor").hidden = !$("#link-editor").hidden; if (!$("#link-editor").hidden) $("#note-target").focus(); }
    if (button.dataset.removeLink && editing) { draft.edit({ links: item.links.filter(link => link.id !== button.dataset.removeLink) }); links(); status(); }
    if (button.dataset.noteOpen) { const link = item.links.find(entry => entry.id === button.dataset.noteOpen)!; void options.notes.open(link.target, events.signal).catch(cause => { if (!destroyed) { error = cause instanceof Error ? cause.message : String(cause); status(); } }); }
    if (action === "add-link" && editing) {
      const target = $<HTMLInputElement>("#note-target").value; const role = $<HTMLSelectElement>("#note-role").value as "reference" | "outcome";
      resolving = true; error = ""; status();
      void options.notes.resolve(target).then(note => { if (destroyed || draft.item?.id !== item.id) return; draft.edit({ links: [...draft.item.links, { ...note, id: crypto.randomUUID(), role }] }); $<HTMLInputElement>("#note-target").value = ""; links(); }).catch(cause => { if (!destroyed) error = cause instanceof Error ? cause.message : String(cause); }).finally(() => { resolving = false; status(); });
    }
  }, { signal: events.signal });
  container.addEventListener("keydown", event => {
    if (root.querySelector(".guard-dialog[open]")) return;
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); void requestClose(); }
    if (event.key === "Tab" && modal) {
      const nodes = Array.from(container.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)')).filter(node => node.getClientRects().length);
      if (event.shiftKey && (document.activeElement === nodes[0] || document.activeElement === $(".detail-pane"))) { event.preventDefault(); nodes.at(-1)?.focus(); }
      if (!event.shiftKey && (document.activeElement === nodes.at(-1) || document.activeElement === $(".detail-pane"))) { event.preventDefault(); nodes[0]?.focus(); }
    }
  }, { signal: events.signal });
  return {
    async open(item: Item, latest: BuddeState): Promise<boolean> {
      if (destroyed || blocked()) return false; if (draft.item?.id === item.id) return true;
      const clicked = root.ownerDocument.activeElement as HTMLElement;
      if (!await requestClose() || destroyed) return false;
      opener = root.contains(clicked) ? clicked : null; openerId = item.id; state = latest; draft.select(item); editing = false; error = ""; render(); $(".detail-pane").focus(); return true;
    }, requestClose, apply,
    refresh(latest: BuddeState) {
      if (destroyed || (state && latest.revision < state.revision)) return;
      state = latest;
      synchronizeRead();
    },
    destroy() { destroyed = true; observer.disconnect(); events.abort(); draft.select(); background().forEach(node => node.inert = false); destroyView(container); container.replaceChildren(); },
  };
}
