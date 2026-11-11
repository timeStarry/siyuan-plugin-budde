import type { BuddeClient, BuddeState, Item, ItemPatch, NoteBridge } from "../../src/core/types";
import { DEMO_NOW } from "./fixture";
import { DraftSession } from "./draft";
import { choose } from "./dialog";
import { isCompleted } from "./model";
import { escape } from "./view";

interface DetailOptions { client: BuddeClient; notes: NoteBridge; onSaved(state: BuddeState): void; onClosed(): void }
export function mountDetail(container: HTMLElement, options: DetailOptions) {
  const draft = new DraftSession();
  const events = new AbortController();
  const workbench = container.closest<HTMLElement>(".workbench")!;
  let state: BuddeState;
  let modal = false;
  let guarding = false;
  let localError = "";
  let message = "";
  let opener: HTMLElement | null = null;
  let openerId = "";
  const $ = <T extends HTMLElement = HTMLElement>(selector: string) => container.querySelector<T>(selector)!;
  const background = () => workbench.querySelectorAll<HTMLElement>(".app-header,.capture-area,.main-panel,.demo-footer");
  function layout(): void {
    modal = !!draft.item && workbench.getBoundingClientRect().width < 1200;
    container.classList.toggle("is-overlay", modal);
    background().forEach((element) => element.inert = modal);
    const pane = container.querySelector<HTMLElement>(".detail-pane");
    if (pane) {
      pane.setAttribute("role", modal ? "dialog" : "region");
      if (modal) pane.setAttribute("aria-modal", "true"); else pane.removeAttribute("aria-modal");
      if (modal && !container.contains(document.activeElement)) $("#detail-title").focus();
    }
  }
  const observer = new ResizeObserver(layout);
  observer.observe(workbench);
  function renderStatus(): void {
    if (!draft.item) return;
    $("#detail-status").textContent = ({ saved: "已保存", dirty: "未保存", saving: "保存中…", error: "保存失败", conflict: "版本已变化" })[draft.status];
    $("#detail-error").textContent = draft.error || localError;
    $("#detail-error").hidden = !(draft.error || localError);
    $("#detail-message").textContent = message;
    $("#detail-message").hidden = !message;
    $<HTMLFieldSetElement>("fieldset").disabled = draft.status === "saving";
    $<HTMLButtonElement>("[data-detail-action=close]").disabled = draft.status === "saving";
    $("[data-detail-action=reload]").hidden = draft.status !== "conflict" && draft.status !== "error";
  }
  function renderLinks(): void {
    const item = draft.item!;
    $("#note-links").innerHTML = item.links.length ? item.links.map((link) => `<li><button type="button" class="note-title" data-note-open="${escape(link.id)}" title="${escape(link.target)}">${link.role === "reference" ? "资料" : "成果"} · ${escape(link.title)}</button><button type="button" class="icon-button" data-remove-link="${escape(link.id)}" aria-label="移除关联：${escape(link.title)}">×</button></li>`).join("") : '<li class="muted">还没有关联笔记。</li>';
  }
  function render(): void {
    const scroll = container.querySelector(".detail-pane")?.scrollTop ?? 0;
    const item = draft.item;
    if (!item) { container.replaceChildren(); layout(); return; }
    const type = state.types.find((entry) => entry.id === item.typeId)!;
    container.innerHTML = `<section class="detail-pane" aria-label="事项详情" tabindex="-1"><div class="detail-heading"><span>事项详情 · <span id="detail-status" role="status"></span></span><button type="button" class="icon-button" data-detail-action="close" aria-label="关闭详情">×</button></div>
      <p id="selected-hidden" class="context-note" hidden>此事项不在当前结果中，详情与草稿仍保留。</p>
      <form id="detail-form" novalidate><fieldset><label for="detail-title">事项标题</label><input id="detail-title" value="${escape(item.title)}" autocomplete="off">
        <div class="detail-selects"><div><label for="detail-type">事项类型</label><select id="detail-type">${state.types.map((entry) => `<option value="${escape(entry.id)}" ${entry.id === item.typeId ? "selected" : ""}>${escape(entry.name)}</option>`).join("")}</select></div><div><label for="detail-stage">事项阶段</label><select id="detail-stage"><option value="" ${!item.stageId ? "selected" : ""}>请选择目标阶段</option>${type.stages.map((stage) => `<option value="${escape(stage.id)}" ${stage.id === item.stageId ? "selected" : ""}>${escape(stage.name)}</option>`).join("")}</select></div></div>
        <label for="detail-next">下一步</label><textarea id="detail-next" rows="3" placeholder="留白也没关系">${escape(item.nextStep)}</textarea>
        <label for="detail-description">简短说明</label><textarea id="detail-description" rows="4" placeholder="留下需要记住的背景，长内容交给思源">${escape(item.description)}</textarea>
        <section class="notes-section" aria-labelledby="note-heading"><h2 id="note-heading">思源笔记</h2><ul id="note-links"></ul><button type="button" class="inline-link" data-detail-action="link"><span aria-hidden="true">＋</span> 关联笔记</button><div id="link-editor" hidden><label for="note-target">笔记目标</label><input id="note-target" placeholder="已有块 ID、思源链接或块引用"><div class="link-add-row"><select id="note-role" aria-label="关联角色"><option value="reference">资料</option><option value="outcome">成果</option></select><button type="button" data-detail-action="add-link">添加关联</button></div><p class="field-help">仅使用合成示例：20260101000000-demo001 或 demo002。同一完整前缀。</p></div></section>
        <div class="save-row"><button class="primary" id="detail-save" type="submit">保存更改</button><span class="field-help">显式保存，不会自动提交</span></div>
        <div id="detail-error" role="alert" hidden></div><p id="detail-message" role="status" hidden></p><button type="button" class="reload-button" data-detail-action="reload" hidden>放弃草稿并读取最新版本</button>
        <div class="detail-actions">${!item.promoted ? '<button type="button" data-detail-action="promote">开始推进</button>' : `<button type="button" data-detail-action="pause">${item.paused ? "恢复推进" : "暂停"}</button>`}<button type="button" data-detail-action="archive">${item.archived ? "移出归档" : "归档事项"}</button><button type="button" data-detail-action="review" ${!item.promoted || item.archived || isCompleted(state, item) ? "disabled" : ""}>已复查</button></div>
        <p class="field-help">暂停与归档保留原阶段；移除关联不删除思源正文。</p>
      </fieldset></form></section>`;
    renderLinks();
    renderStatus();
    layout();
    $(".detail-pane").scrollTop = scroll;
  }
  async function save(extra?: ItemPatch): Promise<boolean> {
    if (draft.status === "saving") return false;
    localError = "";
    message = "";
    const pending = draft.save(options.client, extra);
    renderStatus();
    try {
      state = await pending;
      render();
      options.onSaved(state);
      return true;
    } catch { renderStatus(); return false; }
  }
  async function requestClose(): Promise<boolean> {
    if (!draft.item) return true;
    if (draft.status === "saving" || guarding) return false;
    if (draft.dirty || draft.status === "conflict" || draft.status === "error") {
      guarding = true;
      const choice = await choose("保存未完成的修改？", "离开会关闭当前详情。保存失败时不会继续跳转；放弃修改只丢弃本地草稿。", [
        { value: "save", label: "保存后继续", primary: true }, { value: "discard", label: "放弃修改" }, { value: "cancel", label: "继续编辑" },
      ], "cancel");
      guarding = false;
      if (choice === "cancel" || (choice === "save" && !await save())) return false;
    }
    const returnId = openerId;
    draft.select();
    render();
    options.onClosed();
    if (opener?.isConnected) opener.focus();
    else workbench.querySelector<HTMLElement>(`[data-open="${CSS.escape(returnId)}"]`)?.focus();
    return true;
  }
  async function apply(patch: ItemPatch, label = "执行此操作"): Promise<void> {
    if (!draft.item || draft.status === "saving" || guarding) return;
    if (draft.dirty) {
      guarding = true;
      const choice = await choose("保存修改并执行？", `将保存当前修改，并${label}。取消会同时保留未保存的输入和事项原状态。`, [
        { value: "save", label: "保存修改并执行", primary: true }, { value: "cancel", label: "取消" },
      ], "cancel");
      guarding = false;
      if (choice !== "save") return;
    }
    await save(patch);
  }
  async function reload(): Promise<void> {
    if (guarding || draft.status === "saving") return;
    guarding = true;
    const choice = await choose("放弃本地草稿并读取最新版本？", "本地尚未保存的标题、下一步、说明和关联都会被替换。不会覆盖其他窗口的修改，也不会自动合并。", [
      { value: "reload", label: "放弃并读取" }, { value: "cancel", label: "继续编辑" },
    ], "cancel");
    guarding = false;
    if (choice !== "reload") return;
    try {
      state = await options.client.snapshot();
      const latest = state.items.find((entry) => entry.id === draft.item!.id);
      draft.discard(latest);
      localError = "";
      message = "已放弃本地草稿并读取最新版本。";
      render();
      options.onSaved(state);
      if (draft.item) $("#detail-title").focus();
    } catch (error) { localError = error instanceof Error ? error.message : String(error); renderStatus(); }
  }
  container.addEventListener("input", (event) => {
    const input = event.target as HTMLInputElement;
    const key = ({ "detail-title": "title", "detail-next": "nextStep", "detail-description": "description" } as Record<string, "title" | "nextStep" | "description">)[input.id];
    if (key) { draft.edit({ [key]: input.value }); message = ""; localError = ""; renderStatus(); }
    if (input.id === "note-target") { localError = ""; renderStatus(); }
  }, { signal: events.signal });
  container.addEventListener("change", (event) => {
    const input = event.target as HTMLSelectElement;
    if (input.id === "detail-type") {
      draft.edit({ typeId: input.value, stageId: "" });
      const type = state.types.find((entry) => entry.id === input.value)!;
      $<HTMLSelectElement>("#detail-stage").innerHTML = `<option value="">请选择目标阶段</option>${type.stages.map((stage) => `<option value="${escape(stage.id)}">${escape(stage.name)}</option>`).join("")}`;
      renderStatus();
    }
    if (input.id === "detail-stage") { draft.edit({ stageId: input.value }); renderStatus(); }
  }, { signal: events.signal });
  container.addEventListener("submit", (event) => { event.preventDefault(); void save().then((saved) => { if (saved) $("#detail-save").focus(); }); }, { signal: events.signal });
  container.addEventListener("click", (event) => {
    if (event.target === container && modal) { void requestClose(); return; }
    const button = (event.target as Element).closest<HTMLButtonElement>("button");
    if (!button || !draft.item || draft.status === "saving") return;
    const item = draft.item;
    const action = button.dataset.detailAction;
    if (action === "close") void requestClose();
    if (action === "reload") void reload();
    if (action === "pause") void apply({ paused: !item.paused }, item.paused ? "恢复推进" : "暂停事项");
    if (action === "archive") void apply({ archived: !item.archived }, item.archived ? "移出归档" : "归档事项");
    if (action === "promote") void apply({ promoted: true }, "开始推进（原阶段不变）");
    if (action === "review") void apply({ reviewedAt: DEMO_NOW }, "确认已经复查");
    if (action === "link") { $("#link-editor").hidden = !$("#link-editor").hidden; if (!$("#link-editor").hidden) $("#note-target").focus(); }
    if (button.dataset.removeLink) {
      draft.edit({ links: item.links.filter((link) => link.id !== button.dataset.removeLink) });
      renderLinks(); renderStatus();
    }
    if (button.dataset.noteOpen) {
      const link = item.links.find((entry) => entry.id === button.dataset.noteOpen)!;
      void options.notes.open(link.target).then(() => { message = "示例笔记已验证；原型不会打开真实思源文档。"; localError = ""; renderStatus(); }).catch((error: Error) => { localError = error.message; renderStatus(); });
    }
    if (action === "add-link") {
      const target = $<HTMLInputElement>("#note-target").value;
      const role = $<HTMLSelectElement>("#note-role").value as "reference" | "outcome";
      button.disabled = true;
      void options.notes.resolve(target).then((note) => {
        if (draft.item?.id !== item.id) return;
        draft.edit({ links: [...draft.item.links, { ...note, id: crypto.randomUUID(), role }] });
        $<HTMLInputElement>("#note-target").value = "";
        localError = ""; renderLinks(); renderStatus();
      }).catch((error: Error) => { localError = error.message; renderStatus(); }).finally(() => { button.disabled = false; });
    }
  }, { signal: events.signal });
  container.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !document.querySelector(".guard-dialog[open]")) { event.preventDefault(); void requestClose(); }
    if (event.key === "Tab" && modal) {
      const focusable = Array.from(container.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex="0"]')).filter((element) => element.getClientRects().length > 0);
      const first = focusable[0]; const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  }, { signal: events.signal });
  return {
    async open(item: Item): Promise<boolean> {
      if (draft.item?.id === item.id) return true;
      if (!await requestClose()) return false;
      opener = document.activeElement as HTMLElement;
      openerId = item.id;
      draft.select(item); localError = ""; message = "";
      state = await options.client.snapshot();
      render(); $("#detail-title").focus();
      return true;
    },
    requestClose, apply,
    refresh(latest: BuddeState): void {
      state = latest;
      if (!draft.item) return;
      const item = latest.items.find((entry) => entry.id === draft.item!.id);
      if (!draft.dirty && draft.status === "saved" && item && item.version !== draft.item.version) { draft.discard(item); render(); }
    },
    destroy(): void { observer.disconnect(); events.abort(); draft.select(); container.replaceChildren(); background().forEach((element) => element.inert = false); },
  };
}
