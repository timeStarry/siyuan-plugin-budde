import type { BuddeClient, BuddeState, ItemPatch } from "../../src/core/types";
import { CaptureRequest, createDemoSession, selectItems, type DemoSession, type Filters, type View } from "./model";
import { escape, renderItems, sprout } from "./view";
import { mountDetail } from "./detail";
import { choose } from "./dialog";
import { mountSettings } from "./settings";

declare global {
  interface Window { buddePrototype: { client: BuddeClient; refresh(): Promise<void>; reset(): Promise<BuddeState> } }
}

export function mountPrototype(root: HTMLElement, session: DemoSession): { refresh(): Promise<void>; destroy(): void } {
  let state: BuddeState;
  let view: View = "pool";
  let boardType = "software";
  let selected = "";
  let captureType = "general";
  let busy = false;
  let composing = false;
  const filters: Filters = { query: "", typeId: "", unpromotedOnly: false };
  const request = new CaptureRequest();
  const events = new AbortController();
  root.innerHTML = `<div class="workbench">
    <header class="app-header"><div class="brand">${sprout}<span>Budde</span></div>
      <nav aria-label="主视图"><button data-view="pool">想法池</button><button data-view="board">看板</button><button data-view="active">正在推进</button></nav>
      <div class="header-secondary"><button data-view="archive" class="quiet">归档</button><details class="more"><summary>更多</summary><div class="menu"><button data-action="settings">管理类型与阶段</button><button data-action="export">导出 JSON</button></div></details></div>
    </header>
    <section class="capture-area" aria-label="快速记录"><form id="capture" novalidate><span class="capture-plus" aria-hidden="true">＋</span><input id="capture-title" aria-label="想法标题" placeholder="记下一个想法，标题就够了" autocomplete="off"><label class="capture-type">新事项类型<select id="create-type" aria-label="新事项类型"></select></label><button class="primary" type="submit">记下来</button></form>
      <div class="capture-feedback"><div id="notice" role="status" aria-live="polite"></div><div id="error" role="alert" hidden></div></div>
    </section>
    <main class="workspace"><section class="main-panel" aria-label="事项工作区"><div class="view-toolbar"><div class="view-heading"><h1></h1><span id="result-count"></span></div><div class="filters"><input type="search" id="title-search" aria-label="搜索事项标题" placeholder="搜索事项标题"><select id="filter-type" aria-label="筛选类型"></select></div></div>
      <div id="pool-modes" class="pool-modes"><button data-pool="all">全部</button><button data-pool="unpromoted">未开始推进</button></div>
      <div class="collection-frame"><aside id="type-index" aria-label="看板类型"></aside><div id="collection" tabindex="-1" aria-label="事项列表"></div></div>
      <p id="board-hint" class="board-hint" hidden>拖动卡片改变阶段，也可以在详情中选择。不同类型保留各自的生命周期。</p>
    </section><div id="detail-host"></div></main>
    <footer class="demo-footer"><span>独立交互原型 · 示例数据，刷新重置</span><details id="demo-tools" class="more"><summary>演示工具</summary><div class="menu demo-menu"><p>以下仅用于演示与验证</p><div class="theme-switch"><button data-demo-theme="light">浅色演示</button><button data-demo-theme="dark">深色演示</button></div><button data-demo-fault="reject-next">下次保存失败</button><button data-demo-fault="lose-response">下次响应丢失</button><button data-demo="external" disabled>模拟外部修改</button><button data-demo="reset">重置示例数据</button></div></details></footer>
    <div id="modal-host"></div><dialog id="settings-dialog" aria-label="管理类型与阶段"></dialog>
  </div>`;
  const $ = <T extends HTMLElement = HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const initialTheme = document.documentElement.dataset.demoTheme ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  root.querySelectorAll<HTMLButtonElement>("[data-demo-theme]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.demoTheme === initialTheme)));
  const captureInput = $<HTMLInputElement>("#capture-title");
  const createType = $<HTMLSelectElement>("#create-type");
  const search = $<HTMLInputElement>("#title-search");
  const filterType = $<HTMLSelectElement>("#filter-type");
  const collection = $("#collection");
  const detail = mountDetail($("#detail-host"), {
    client: session.client, notes: session.notes,
    onSaved(next) { state = next; render(); },
    onClosed() { selected = ""; render(); },
  });
  let settingsOpener = "header .more summary";
  const settings = mountSettings($<HTMLDialogElement>("#settings-dialog"), {
    client: session.client,
    onSaved(next) { state = next; render(); },
    onClosed() { root.querySelector<HTMLElement>(settingsOpener)?.focus(); },
    async confirmDiscard() {
      return await choose("放弃设置草稿并读取最新配置？", "尚未保存的设置输入会被丢弃。不会覆盖其他操作已经提交的配置。", [{ value: "reload", label: "放弃并读取" }, { value: "cancel", label: "继续编辑" }], "cancel") === "reload";
    },
  });
  const listen = (name: string, listener: EventListener) => root.addEventListener(name, listener, { signal: events.signal });
  function notify(message: string, error = false, showPool = false): void {
    $("#error").hidden = !error;
    $("#error").textContent = error ? message : "";
    $("#notice").innerHTML = error ? "" : `${escape(message)}${message && showPool && view !== "pool" ? ' <button class="inline-link" data-view="pool">查看想法池</button>' : ""}`;
  }
  function render(): void {
    if (!state.types.some((type) => type.id === boardType)) boardType = state.types[0].id;
    if (!state.types.some((type) => type.id === captureType)) captureType = state.types.find((type) => type.id === "general")?.id ?? state.types[0].id;
    if (!state.types.some((type) => type.id === filters.typeId)) filters.typeId = "";
    const options = state.types.map((type) => `<option value="${escape(type.id)}">${escape(type.name)}</option>`).join("");
    createType.innerHTML = options;
    createType.value = captureType;
    filterType.innerHTML = `<option value="">所有类型</option>${options}`;
    filterType.value = filters.typeId;
    filterType.hidden = view === "board";
    search.value = filters.query;
    root.querySelectorAll<HTMLButtonElement>("header [data-view]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.view === view)));
    $("#pool-modes").hidden = view !== "pool";
    root.querySelectorAll<HTMLButtonElement>("[data-pool]").forEach((button) => button.setAttribute("aria-pressed", String((button.dataset.pool === "unpromoted") === filters.unpromotedOnly)));
    const currentFilters = { ...filters, typeId: view === "board" ? boardType : filters.typeId };
    const type = state.types.find((entry) => entry.id === boardType)!;
    $("h1").textContent = view === "board" ? `${type.name}看板` : ({ pool: "想法池", active: "正在推进", archive: "归档" })[view];
    $("#result-count").textContent = `${selectItems(state, view, currentFilters).length} 个事项`;
    $("#type-index").hidden = view !== "board";
    $("#board-hint").hidden = view !== "board";
    $("#type-index").innerHTML = `<p class="index-label">按类型查看</p>${state.types.map((entry) => `<button data-board-type="${escape(entry.id)}" aria-pressed="${entry.id === boardType}"><span>${escape(entry.name)}</span><span>${selectItems(state, "board", { ...filters, typeId: entry.id }).length}</span></button>`).join("")}<button class="manage-types" data-action="settings">管理类型与阶段</button>`;
    const position = { top: collection.scrollTop, left: collection.scrollLeft };
    collection.className = view === "board" ? "board-collection" : "list-collection";
    collection.innerHTML = renderItems(state, view, currentFilters, selected);
    collection.scrollTop = position.top;
    collection.scrollLeft = position.left;
    detail.refresh(state);
    const hiddenNote = root.querySelector<HTMLElement>("#selected-hidden");
    if (hiddenNote) hiddenNote.hidden = selectItems(state, view, currentFilters).some((item) => item.id === selected);
    $<HTMLButtonElement>('[data-demo="external"]').disabled = !selected;
  }
  async function refresh(): Promise<void> { state = await session.client.snapshot(); render(); }
  async function mutate(id: string, patch: ItemPatch): Promise<void> {
    if (id === selected) { await detail.apply(patch, patch.stageId ? "改变阶段" : "开始推进"); return; }
    const item = state.items.find((entry) => entry.id === id);
    if (!item) return;
    try {
      state = (await session.client.execute({ kind: "item.update", id, expectedVersion: item.version, patch })).state;
      notify(patch.stageId ? "阶段已更新。" : "已开始推进，原阶段保持不变。");
      render();
    } catch (error) { notify(error instanceof Error ? error.message : String(error), true); }
  }
  listen("submit", ((event: SubmitEvent) => {
    if ((event.target as HTMLElement).id !== "capture") return;
    event.preventDefault();
    if (busy || composing) return;
    busy = true;
    const form = event.target as HTMLFormElement;
    form.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLSelectElement>("input,button,select").forEach((input) => input.disabled = true);
    void (async () => {
      try {
        state = (await session.client.execute(request.prepare(captureInput.value, captureType))).state;
        request.success();
        captureInput.value = "";
        notify("已记入想法池，尚未开始推进。继续记录下一条吧。", false, true);
        render();
      } catch (error) { notify(error instanceof Error ? error.message : String(error), true); }
      finally {
        busy = false;
        form.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLSelectElement>("input,button,select").forEach((input) => input.disabled = false);
        captureInput.focus();
      }
    })();
  }) as EventListener);
  listen("keydown", ((event: KeyboardEvent) => {
    const menu = (event.target as Element).closest<HTMLDetailsElement>(".more[open],.card-menu[open]");
    if (event.key === "Escape" && menu) { event.preventDefault(); menu.open = false; menu.querySelector<HTMLElement>("summary")?.focus(); }
  }) as EventListener);
  listen("compositionstart", (() => { composing = true; }) as EventListener);
  listen("compositionend", (() => { composing = false; }) as EventListener);
  listen("keydown", ((event: KeyboardEvent) => {
    if (event.target === captureInput && event.key === "Enter" && (event.isComposing || composing || event.keyCode === 229)) event.preventDefault();
  }) as EventListener);
  listen("input", ((event: Event) => { if (event.target === search) { filters.query = search.value; render(); } }) as EventListener);
  listen("change", ((event: Event) => {
    if (event.target === createType) captureType = createType.value;
    if (event.target === filterType) { filters.typeId = filterType.value; render(); }
  }) as EventListener);
  listen("click", ((event: MouseEvent) => {
    const target = event.target as Element;
    root.querySelectorAll<HTMLDetailsElement>(".more[open],.card-menu[open]").forEach((menu) => {
      if (!menu.contains(target) || target.closest("button")) menu.open = false;
    });
    const button = (event.target as Element).closest<HTMLElement>("button");
    if (!button || !root.contains(button)) return;
    if (button.dataset.view && button.dataset.view !== view) void (async () => {
      if (await detail.requestClose()) { view = button.dataset.view as View; render(); }
    })();
    if (button.dataset.boardType && button.dataset.boardType !== boardType) void (async () => {
      if (await detail.requestClose()) { boardType = button.dataset.boardType!; render(); }
    })();
    if (button.dataset.pool) { filters.unpromotedOnly = button.dataset.pool === "unpromoted"; render(); }
    if (button.dataset.open) void (async () => {
      const item = state.items.find((entry) => entry.id === button.dataset.open);
      if (item && await detail.open(item)) { selected = item.id; render(); }
    })();
    if (button.dataset.stageItem && button.dataset.stageTarget) void mutate(button.dataset.stageItem, { stageId: button.dataset.stageTarget });
    if (button.dataset.demoTheme) {
      document.documentElement.dataset.demoTheme = button.dataset.demoTheme;
      root.querySelectorAll<HTMLButtonElement>("[data-demo-theme]").forEach((entry) => entry.setAttribute("aria-pressed", String(entry.dataset.demoTheme === button.dataset.demoTheme)));
    }
    if (button.dataset.demoFault) { session.armFault(button.dataset.demoFault as "reject-next" | "lose-response"); notify("已启用一次模拟故障，仅影响下一次修改操作。"); }
    if (button.dataset.demo === "external" && selected) void session.simulateExternalChange(selected).then(refresh).catch((error: Error) => notify(error.message, true));
    if (button.dataset.demo === "reset") void (async () => {
      const answer = await choose("重置全部示例数据？", "所有演示修改都会丢失，重新载入最初的合成事项。不会影响真实思源。", [{ value: "reset", label: "重置示例" }, { value: "cancel", label: "取消" }], "cancel");
      if (answer === "reset" && await detail.requestClose()) { await session.reset(); request.success(); captureInput.value = ""; await refresh(); notify("示例数据已重置。"); }
    })();
    if (button.dataset.promote) void mutate(button.dataset.promote, { promoted: true });
    if (button.dataset.action === "settings") {
      const opener = button.closest("#type-index") ? '#type-index [data-action="settings"]' : "header .more summary";
      void (async () => { if (await detail.requestClose()) { settingsOpener = opener; await settings.open(); } })();
    }
    if (button.dataset.action === "export") void (async () => {
      try {
        const data = await session.client.exportData();
        const url = URL.createObjectURL(new Blob([data], { type: "application/json" }));
        const link = document.createElement("a"); link.href = url; link.download = "budde-demo.json"; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 0);
        notify("已导出演示 JSON，不包含思源笔记正文。");
      } catch (error) { notify(error instanceof Error ? error.message : String(error), true); }
    })();
    if (button.dataset.action === "focus-capture") captureInput.focus();
    if (button.dataset.action === "clear-filters") { filters.query = ""; filters.typeId = ""; filters.unpromotedOnly = false; render(); search.focus(); }
  }) as EventListener);
  listen("dragstart", ((event: DragEvent) => {
    const item = (event.target as Element).closest<HTMLElement>("[data-item-id][draggable]");
    if (item && event.dataTransfer) { event.dataTransfer.setData("text/budde-item", item.dataset.itemId!); event.dataTransfer.effectAllowed = "move"; }
  }) as EventListener);
  listen("dragover", ((event: DragEvent) => { if ((event.target as Element).closest("[data-stage-id]")) event.preventDefault(); }) as EventListener);
  listen("drop", ((event: DragEvent) => {
    const stage = (event.target as Element).closest<HTMLElement>("[data-stage-id]");
    const id = event.dataTransfer?.getData("text/budde-item");
    const item = state.items.find((entry) => entry.id === id);
    if (!stage || !item || item.typeId !== boardType || item.archived || !item.promoted) return;
    event.preventDefault();
    if (item.stageId !== stage.dataset.stageId) void mutate(item.id, { stageId: stage.dataset.stageId });
  }) as EventListener);
  return { refresh, destroy() { settings.destroy(); detail.destroy(); events.abort(); root.replaceChildren(); } };
}

const session = createDemoSession();
const mounted = mountPrototype(document.getElementById("prototype")!, session);
void mounted.refresh().then(() => { window.buddePrototype = { client: session.client, refresh: mounted.refresh, reset: session.reset }; });
