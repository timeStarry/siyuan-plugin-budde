import type { BuddeClient, BuddeState, ItemPatch } from "../../src/core/types";
import { CaptureRequest, createDemoSession, selectItems, type DemoSession, type Filters, type View } from "./model";
import { escape, renderItems, sprout } from "./view";

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
      <div class="header-secondary"><button data-view="archive" class="quiet">归档</button><details class="more"><summary>更多</summary><div class="menu"><button data-action="settings" disabled>管理类型与阶段</button><button data-action="export" disabled>导出 JSON</button></div></details></div>
    </header>
    <section class="capture-area" aria-label="快速记录"><form id="capture" novalidate><span class="capture-plus" aria-hidden="true">＋</span><input id="capture-title" aria-label="想法标题" placeholder="记下一个想法，标题就够了" autocomplete="off"><label class="capture-type">新事项类型<select id="create-type" aria-label="新事项类型"></select></label><button class="primary" type="submit">记下来</button></form>
      <div class="capture-feedback"><div id="notice" role="status" aria-live="polite"></div><div id="error" role="alert" hidden></div></div>
    </section>
    <main class="workspace"><section class="main-panel" aria-label="事项工作区"><div class="view-toolbar"><div class="view-heading"><h1></h1><span id="result-count"></span></div><div class="filters"><input type="search" id="title-search" aria-label="搜索事项标题" placeholder="搜索事项标题"><select id="filter-type" aria-label="筛选类型"></select></div></div>
      <div id="pool-modes" class="pool-modes"><button data-pool="all">全部</button><button data-pool="unpromoted">未开始推进</button></div>
      <div class="collection-frame"><aside id="type-index" aria-label="看板类型"></aside><div id="collection" tabindex="-1" aria-label="事项列表"></div></div>
      <p id="board-hint" class="board-hint" hidden>拖动卡片改变阶段，也可以在详情中选择。不同类型保留各自的生命周期。</p>
    </section><div id="detail-host"></div></main>
    <footer class="demo-footer"><span>独立交互原型 · 示例数据，刷新重置</span><span>不连接真实思源数据</span></footer>
    <div id="modal-host"></div><dialog id="settings-dialog" aria-label="管理类型与阶段"></dialog>
  </div>`;
  const $ = <T extends HTMLElement = HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const captureInput = $<HTMLInputElement>("#capture-title");
  const createType = $<HTMLSelectElement>("#create-type");
  const search = $<HTMLInputElement>("#title-search");
  const filterType = $<HTMLSelectElement>("#filter-type");
  const collection = $("#collection");
  const listen = (name: string, listener: EventListener) => root.addEventListener(name, listener, { signal: events.signal });
  function notify(message: string, error = false): void {
    $("#error").hidden = !error;
    $("#error").textContent = error ? message : "";
    $("#notice").innerHTML = error ? "" : `${escape(message)}${message && view !== "pool" ? ' <button class="inline-link" data-view="pool">查看想法池</button>' : ""}`;
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
    $("#type-index").innerHTML = `<p class="index-label">按类型查看</p>${state.types.map((entry) => `<button data-board-type="${escape(entry.id)}" aria-pressed="${entry.id === boardType}"><span>${escape(entry.name)}</span><span>${selectItems(state, "board", { ...filters, typeId: entry.id }).length}</span></button>`).join("")}<button class="manage-types" data-action="settings" disabled>管理类型与阶段</button>`;
    const position = { top: collection.scrollTop, left: collection.scrollLeft };
    collection.className = view === "board" ? "board-collection" : "list-collection";
    collection.innerHTML = renderItems(state, view, currentFilters, selected);
    collection.scrollTop = position.top;
    collection.scrollLeft = position.left;
  }
  async function refresh(): Promise<void> { state = await session.client.snapshot(); render(); }
  async function mutate(id: string, patch: ItemPatch): Promise<void> {
    const item = state.items.find((entry) => entry.id === id);
    if (!item) return;
    try {
      state = (await session.client.execute({ kind: "item.update", id, expectedVersion: item.version, patch })).state;
      notify("已开始推进，原阶段保持不变。");
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
        notify("已记入想法池，尚未开始推进。继续记录下一条吧。");
        render();
      } catch (error) { notify(error instanceof Error ? error.message : String(error), true); }
      finally {
        busy = false;
        form.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLSelectElement>("input,button,select").forEach((input) => input.disabled = false);
        captureInput.focus();
      }
    })();
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
    const button = (event.target as Element).closest<HTMLElement>("button");
    if (!button || !root.contains(button)) return;
    if (button.dataset.view) { view = button.dataset.view as View; selected = ""; render(); }
    if (button.dataset.boardType) { boardType = button.dataset.boardType; selected = ""; render(); }
    if (button.dataset.pool) { filters.unpromotedOnly = button.dataset.pool === "unpromoted"; render(); }
    if (button.dataset.open) { selected = button.dataset.open; render(); }
    if (button.dataset.promote) void mutate(button.dataset.promote, { promoted: true });
    if (button.dataset.action === "focus-capture") captureInput.focus();
    if (button.dataset.action === "clear-filters") { filters.query = ""; filters.typeId = ""; filters.unpromotedOnly = false; render(); search.focus(); }
  }) as EventListener);
  return { refresh, destroy() { events.abort(); root.replaceChildren(); } };
}

const session = createDemoSession();
const mounted = mountPrototype(document.getElementById("prototype")!, session);
void mounted.refresh().then(() => { window.buddePrototype = { client: session.client, refresh: mounted.refresh, reset: session.reset }; });
