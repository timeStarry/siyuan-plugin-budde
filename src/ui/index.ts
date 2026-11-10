import type {
  BuddeClient,
  BuddeState,
  Command,
  Item,
  ItemPatch,
  ItemType,
  NoteBridge,
} from "../core/types";

const escape = (s: unknown) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const option = (id: string, label: string, selected: string) =>
  `<option value="${escape(id)}" ${id === selected ? "selected" : ""}>${escape(label)}</option>`;
const uid = () => crypto.randomUUID();
type View = "pool" | "board" | "active";

export function mountWorkbench(
  element: HTMLElement,
  client: BuddeClient,
  notes: NoteBridge,
) {
  let state: BuddeState | undefined;
  let view: View = "pool";
  let query = "",
    typeId = "",
    archive = false,
    title = "";
  let selected = "",
    draft: Item | undefined,
    dirty = false,
    busy = false,
    destroyed = false,
    manager = false;
  let error = "",
    notice = "",
    capture: { signature: string; requestId: string } | undefined;
  let managerType = "",
    dragging = "";
  const captureId = `budde-title-${uid()}`;
  let linkTarget = "",
    linkRole = "reference";
  const settingsDrafts = new Map<string, string | boolean>();
  const settingKey = (form: HTMLFormElement, control: HTMLInputElement) =>
    `${managerType}|${form.dataset.form}|${form.dataset.id ?? ""}|${control.name}`;
  const findType = (id: string) => state?.types.find((t) => t.id === id);
  const isComplete = (item: Item) =>
    !!findType(item.typeId)?.stages.find((s) => s.id === item.stageId)
      ?.completed;
  const active = (item: Item) =>
    item.promoted && !item.paused && !item.archived && !isComplete(item);
  const overdue = (item: Item) =>
    item.promoted &&
    !item.archived &&
    !isComplete(item) &&
    !!item.reviewedAt &&
    Date.now() - Date.parse(item.reviewedAt) >= 14 * 86400000;
  const matches = (item: Item) =>
    item.archived === archive &&
    (!typeId || item.typeId === typeId) &&
    item.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  const stages = (item: Item) => findType(item.typeId)?.stages ?? [];
  const button = (label: string, action: string, extra = "") =>
    `<button type="button" data-action="${action}" ${extra} ${busy ? "disabled" : ""}>${label}</button>`;
  const options = (value: string, types = state?.types ?? []) =>
    types.map((t) => option(t.id, t.name, value)).join("");

  function card(item: Item) {
    const type = findType(item.typeId);
    return `<article class="budde-item ${selected === item.id ? "is-selected" : ""}" draggable="${!busy}" data-item="${escape(item.id)}">
      <button type="button" class="budde-item-title" data-action="select" data-id="${escape(item.id)}">${escape(item.title)}</button>
      <div class="budde-item-meta"><span>${escape(type?.name)} · ${escape(type?.stages.find((s) => s.id === item.stageId)?.name)}</span>${item.paused ? "<span>已暂停</span>" : ""}${isComplete(item) ? "<span>已完成</span>" : ""}${overdue(item) ? "<span>待复查</span>" : ""}</div>
      ${item.nextStep ? `<p class="budde-next">下一步：${escape(item.nextStep)}</p>` : ""}
      <div class="budde-item-actions">${!item.promoted && !archive ? button("开始推进", "promote-card", `data-id="${escape(item.id)}"`) : ""}<label class="budde-stage-label">阶段<select aria-label="${escape(item.title)}的阶段" data-card-stage="${escape(item.id)}" ${busy ? "disabled" : ""}>${stages(
        item,
      )
        .map((s) => option(s.id, s.name, item.stageId))
        .join("")}</select></label></div>
    </article>`;
  }

  function content() {
    if (!state)
      return '<div class="budde-loading" role="status">正在读取想法池…</div>';
    let items = state.items.filter(matches);
    if (view === "active") items = items.filter(active);
    if (view !== "board")
      return items.length
        ? `<div class="budde-list">${items.map(card).join("")}</div>`
        : `<div class="budde-empty"><strong>${query ? "没有找到这个标题" : archive ? "还没有归档事项" : view === "active" ? "暂时没有正在推进的事项" : "先留下一个标题"}</strong><p>${query ? "换个关键词，或清除类型筛选。" : view === "active" ? "在池子中选择一个想法，想做时再开始推进。" : "不需要日期，也不需要先建一篇笔记。"}</p></div>`;
    items = items.filter((i) => i.promoted);
    const types = state.types.filter((t) => !typeId || t.id === typeId);
    return types
      .map(
        (t) =>
          `<section class="budde-board-group"><h2>${escape(t.name)} <span>${items.filter((i) => i.typeId === t.id).length}</span></h2><div class="budde-lanes">${t.stages
            .map((s) => {
              const lane = items.filter(
                (i) => i.typeId === t.id && i.stageId === s.id,
              );
              return `<section class="budde-lane" data-drop-type="${escape(t.id)}" data-drop-stage="${escape(s.id)}" aria-label="${escape(t.name + "：" + s.name)}"><h3>${escape(s.name)} <span>${lane.length}</span></h3>${lane.length ? lane.map(card).join("") : '<p class="budde-lane-empty">暂无事项</p>'}</section>`;
            })
            .join("")}</div></section>`,
      )
      .join("");
  }

  function detail() {
    if (!draft) return "";
    const current = state?.items.find((i) => i.id === selected);
    const stale = current && current.version !== draft.version;
    return `<aside class="budde-detail" aria-label="事项详情"><div class="budde-detail-heading"><h2>事项详情</h2>${button("关闭", "close")}</div>
      <p class="budde-draft-status" role="status">${dirty ? "有未保存的修改" : "已保存"}${stale ? " · 其他窗口已有新版本，当前草稿已保留。" : ""}</p>
      ${stale || dirty ? button("放弃草稿并读取最新版本", "reload") : ""}
      <form data-form="detail"><label>标题<input name="title" data-field="title" value="${escape(draft.title)}" required /></label>
      <div class="budde-field-pair"><label>类型<select data-field="typeId">${options(draft.typeId)}</select></label><label>阶段<select data-field="stageId">${stages(
        draft,
      )
        .map((s) => option(s.id, s.name, draft!.stageId))
        .join("")}</select></label></div>
      <label>说明<textarea data-field="description" rows="3" placeholder="需要时再展开">${escape(draft.description)}</textarea></label>
      <label>下一步<textarea data-field="nextStep" rows="2" placeholder="下一次准备做什么">${escape(draft.nextStep)}</textarea></label>
      <button type="submit" class="budde-primary" ${busy ? "disabled" : ""}>${busy ? "正在保存…" : "保存修改"}</button></form>
      <div class="budde-detail-actions">${!draft.promoted ? button("开始推进", "promote") : button(draft.paused ? "恢复推进" : "暂停", "pause")}${button(draft.archived ? "恢复归档" : "归档", "archive")}${draft.promoted ? button("已复查", "review") : ""}</div>
      <section class="budde-links"><h3>关联笔记与成果</h3><p class="budde-hint">关联已有思源文档或块，笔记仍在思源中编辑。</p>${draft.links.map((link) => `<div class="budde-link"><button type="button" data-action="open-link" data-id="${escape(link.id)}">${link.role === "outcome" ? "成果" : "资料"} · ${escape(link.title)}</button>${button("移除", "remove-link", `data-id="${escape(link.id)}" aria-label="移除${escape(link.title)}的关联"`)}</div>`).join("")}
      <form data-form="link"><label>思源块 ID 或链接<input name="target" placeholder="粘贴块链接或块引用" value="${escape(linkTarget)}" required /></label><label>关联用途<select name="role">${option("reference", "资料", linkRole)}${option("outcome", "成果", linkRole)}</select></label><button ${busy ? "disabled" : ""}>添加关联</button></form></section>
      <p class="budde-hint">${escape(draft.id)} · 版本 ${draft.version}</p>
    </aside>`;
  }

  function settings() {
    if (!manager || !state) return "";
    const type = findType(managerType) ?? state.types[0];
    if (!type) return "";
    managerType = type.id;
    return `<dialog class="budde-settings" aria-label="类型与阶段设置"><div class="budde-detail-heading"><h2>类型与阶段</h2>${button("关闭", "close-settings")}</div>${error ? `<p role="alert" class="budde-setting-error">${escape(error)}</p>${button("读取最新配置并放弃设置草稿", "reload-settings")}` : ""}
      <label>选择类型<select data-setting-type>${options(type.id)}</select></label>
      <form data-form="type-name"><label>类型名称<input name="name" value="${escape(type.name)}" required /></label><label>初始阶段<select name="initialStageId">${type.stages.map((s) => option(s.id, s.name, type.initialStageId)).join("")}</select></label><button ${busy ? "disabled" : ""}>保存名称</button>${button("删除空类型", "delete-type")}</form>
      <p class="budde-hint">阶段改名和排序不会改变已有事项。删除有事项的阶段时，请选择迁移目标。</p>
      <div class="budde-stage-settings">${type.stages
        .map(
          (s, index) =>
            `<form data-form="stage-edit" data-id="${escape(s.id)}"><input name="name" aria-label="阶段名称" value="${escape(s.name)}" required /><label class="budde-check"><input name="completed" type="checkbox" ${s.completed ? "checked" : ""} />完成阶段</label><button ${busy ? "disabled" : ""}>保存</button>${button("↑", "stage-up", `data-id="${escape(s.id)}" aria-label="上移${escape(s.name)}" ${index === 0 ? "disabled" : ""}`)}${button("↓", "stage-down", `data-id="${escape(s.id)}" aria-label="下移${escape(s.name)}" ${index === type.stages.length - 1 ? "disabled" : ""}`)}<select name="target" aria-label="删除后迁移至"><option value="">迁移到…</option>${type.stages
              .filter((x) => x.id !== s.id)
              .map((x) => option(x.id, x.name, ""))
              .join(
                "",
              )}</select>${button("删除", "stage-delete", `data-id="${escape(s.id)}"`)}</form>`,
        )
        .join("")}</div>
      <form data-form="stage-add"><label>新增阶段<input name="name" placeholder="阶段名称" required /></label><button ${busy ? "disabled" : ""}>添加阶段</button></form>
      <form data-form="type-add"><label>新增类型<input name="name" placeholder="类型名称" required /></label><button ${busy ? "disabled" : ""}>添加类型</button></form>
    </dialog>`;
  }

  function render() {
    if (destroyed) return;
    const focused = element.ownerDocument.activeElement as
      | HTMLInputElement
      | HTMLTextAreaElement
      | null;
    const focusKey =
      focused && element.contains(focused)
        ? (focused.getAttribute("data-field") ??
          focused.getAttribute("data-focus"))
        : null;
    const selection =
      focused && ["INPUT", "TEXTAREA"].includes(focused.tagName)
        ? [focused.selectionStart, focused.selectionEnd]
        : null;
    element.classList.add("budde");
    element.innerHTML = `<header class="budde-header"><div><h1>Budde</h1><p>先记下来，想做时再展开。</p></div><div class="budde-header-actions">${button("类型与阶段", "settings")}${button("导出", "export")}${button("刷新", "refresh")}</div></header>
      <nav class="budde-nav" aria-label="工作台视图">${(["pool", "board", "active"] as View[]).map((v, i) => `<button type="button" data-action="view" data-view="${v}" aria-current="${view === v ? "page" : "false"}">${["池子", "看板", "正在推进"][i]}</button>`).join("")}</nav>
      <div class="budde-overview" aria-label="概览"><span>池中 ${state?.items.filter((i) => !i.archived).length ?? 0}</span><span>进行中 ${state?.items.filter(active).length ?? 0}</span><span>待复查 ${state?.items.filter(overdue).length ?? 0}</span></div>
      <form class="budde-capture" data-form="capture"><label class="budde-sr-only" for="${captureId}">记录一个标题</label><input id="${captureId}" data-focus="capture" name="title" placeholder="记下一个想法，标题就够了" value="${escape(title)}" required /><button class="budde-primary" ${busy || !state ? "disabled" : ""}>记下来</button></form>
      <div class="budde-toolbar"><label>搜索<input data-search data-focus="search" placeholder="搜索标题" value="${escape(query)}" /></label><label>类型<select data-type>${option("", "全部类型", typeId)}${options(typeId)}</select></label><label class="budde-check"><input type="checkbox" data-archive ${archive ? "checked" : ""} />查看归档</label></div>
      <div class="budde-message" role="${error ? "alert" : "status"}">${escape(error || notice)}</div>
      <div class="budde-body ${draft ? "has-detail" : ""}"><main class="budde-main">${content()}</main>${detail()}</div>${settings()}`;
    const dialog = element.querySelector<HTMLDialogElement>("dialog");
    if (dialog) {
      dialog
        .querySelectorAll<HTMLInputElement>("form input, form select")
        .forEach((control) => {
          const value = settingsDrafts.get(
            settingKey(control.closest("form")!, control),
          );
          if (typeof value === "boolean") control.checked = value;
          else if (typeof value === "string") control.value = value;
        });
      dialog.showModal();
      dialog.addEventListener("cancel", (e) => {
        e.preventDefault();
        manager = false;
        settingsDrafts.clear();
        render();
        void refresh().catch(() => undefined);
      });
    }
    if (busy)
      element
        .querySelectorAll<HTMLInputElement>("input, select, textarea")
        .forEach((control) => {
          control.disabled = true;
        });
    if (focusKey) {
      const target = element.querySelector<HTMLInputElement>(
        `[data-field="${focusKey}"], [data-focus="${focusKey}"]`,
      );
      target?.focus();
      if (
        target &&
        selection &&
        typeof selection[0] === "number" &&
        ["text", "search", "textarea"].includes(target.type)
      )
        target.setSelectionRange(selection[0], selection[1]);
    }
  }

  async function refresh(force = false) {
    if ((!force && busy) || (manager && state)) return;
    const next = await client.snapshot();
    if (
      destroyed ||
      (!force && busy) ||
      (manager && state) ||
      (state && next.revision <= state.revision)
    )
      return;
    state = next;
    if (selected && !dirty)
      draft = structuredClone(state.items.find((i) => i.id === selected));
    render();
  }
  async function run(task: () => Promise<void>) {
    if (busy) return;
    const activeControl = element.ownerDocument
      .activeElement as HTMLElement | null;
    const focusKey =
      activeControl?.getAttribute("data-focus") ??
      activeControl?.getAttribute("data-field");
    busy = true;
    error = "";
    notice = "";
    render();
    try {
      await task();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      if (!manager)
        try {
          state = await client.snapshot();
        } catch {
          /* preserve last visible data and draft */
        }
    } finally {
      busy = false;
      render();
      if (focusKey)
        element
          .querySelector<HTMLElement>(
            `[data-focus="${focusKey}"], [data-field="${focusKey}"]`,
          )
          ?.focus();
    }
  }
  async function execute(command: Command) {
    const result = await client.execute(command);
    state = result.state;
    if (selected && !dirty)
      draft = structuredClone(state.items.find((i) => i.id === selected));
    return result;
  }
  function draftPatch(): ItemPatch {
    if (!draft) return {};
    return {
      title: draft.title,
      typeId: draft.typeId,
      stageId: draft.stageId,
      description: draft.description,
      nextStep: draft.nextStep,
      links: structuredClone(draft.links),
    };
  }
  async function save(patch: ItemPatch = {}) {
    if (!draft) return;
    await execute({
      kind: "item.update",
      id: draft.id,
      expectedVersion: draft.version,
      patch: { ...draftPatch(), ...patch },
    });
    draft = structuredClone(state!.items.find((i) => i.id === selected));
    dirty = false;
    notice = "已保存";
  }
  function setDraft(item?: Item) {
    selected = item?.id ?? "";
    draft = item ? structuredClone(item) : undefined;
    dirty = false;
    linkTarget = "";
    linkRole = "reference";
  }
  function canLeave() {
    if (dirty) {
      error = "详情有未保存的修改，请先保存，或选择“放弃草稿并读取最新版本”。";
      render();
      return false;
    }
    return true;
  }

  function input(event: Event) {
    const target = event.target as HTMLInputElement;
    const settingForm = target.closest<HTMLFormElement>(".budde-settings form");
    if (settingForm && target.name)
      settingsDrafts.set(
        settingKey(settingForm, target),
        target.type === "checkbox" ? target.checked : target.value,
      );
    if (target.closest('[data-form="link"]')) {
      if (target.name === "target") linkTarget = target.value;
      if (target.name === "role") linkRole = target.value;
    }
    if (target.matches('[data-focus="capture"]')) title = target.value;
    if (target.matches("[data-search]")) {
      query = target.value;
      render();
    }
    const field = target.dataset.field;
    if (draft && field) {
      if (field === "typeId") {
        draft.typeId = target.value;
        draft.stageId = findType(target.value)!.initialStageId;
        dirty = true;
        render();
      } else if (
        field === "title" ||
        field === "description" ||
        field === "nextStep" ||
        field === "stageId"
      ) {
        draft[field] = target.value;
        dirty = true;
        const status = element.querySelector(".budde-draft-status");
        if (status) status.textContent = "有未保存的修改";
      }
    }
  }
  function change(event: Event) {
    const target = event.target as HTMLInputElement;
    if (target.matches("[data-type]")) {
      typeId = target.value;
      render();
    }
    if (target.matches("[data-archive]")) {
      archive = target.checked;
      render();
    }
    if (target.matches("[data-setting-type]")) {
      managerType = target.value;
      render();
    }
    const id = target.dataset.cardStage;
    if (id) {
      const item = state!.items.find((i) => i.id === id)!;
      if (dirty && selected === id) {
        error = "请先保存详情中的修改，再改变阶段。";
        render();
        return;
      }
      void run(async () => {
        await execute({
          kind: "item.update",
          id,
          expectedVersion: item.version,
          patch: { stageId: target.value },
        });
        if (selected === id) setDraft(state!.items.find((i) => i.id === id));
      });
    }
  }
  function submit(event: Event) {
    const form = event.target as HTMLFormElement;
    if (!form.dataset.form) return;
    event.preventDefault();
    const data = new FormData(form),
      name = String(data.get("name") ?? ""),
      target = String(data.get("target") ?? "");
    const formKind = form.dataset.form,
      stageId = form.dataset.id,
      formManagerType = managerType;
    void run(async () => {
      if (formKind === "capture") {
        const signature = JSON.stringify([title, typeId]);
        if (capture?.signature !== signature)
          capture = { signature, requestId: uid() };
        await execute({
          kind: "item.create",
          requestId: capture.requestId,
          title,
          ...(typeId ? { typeId } : {}),
        });
        title = "";
        capture = undefined;
        notice = "已记下";
      } else if (formKind === "detail") await save();
      else if (formKind === "link" && draft) {
        const resolved = await notes.resolve(target);
        if (!draft.links.some((l) => l.target === resolved.target))
          draft.links.push({
            id: uid(),
            ...resolved,
            role: data.get("role") === "outcome" ? "outcome" : "reference",
          });
        dirty = true;
        notice = "关联已加入草稿，保存后生效";
        linkTarget = "";
      } else if (formKind === "type-name")
        await execute({
          kind: "type.update",
          expectedRevision: state!.revision,
          id: managerType,
          name,
          initialStageId: String(data.get("initialStageId")),
        });
      else if (formKind === "type-add") {
        await execute({
          kind: "type.create",
          expectedRevision: state!.revision,
          name,
        });
        managerType = state!.types.at(-1)!.id;
      } else if (formKind === "stage-add")
        await execute({
          kind: "stage.add",
          expectedRevision: state!.revision,
          typeId: managerType,
          name,
        });
      else if (formKind === "stage-edit")
        await execute({
          kind: "stage.update",
          expectedRevision: state!.revision,
          typeId: managerType,
          id: stageId!,
          name,
          completed: data.get("completed") === "on",
        });
      if (formKind?.startsWith("type-") || formKind?.startsWith("stage-"))
        for (const key of settingsDrafts.keys())
          if (
            key.startsWith(`${formManagerType}|${formKind}|${stageId ?? ""}|`)
          )
            settingsDrafts.delete(key);
    }).then(() => {
      if (formKind === "capture" && !error)
        element
          .querySelector<HTMLInputElement>('[data-focus="capture"]')
          ?.focus();
    });
  }
  function click(event: Event) {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>(
      "[data-action]",
    );
    if (!target || target.disabled) return;
    const action = target.dataset.action,
      id = target.dataset.id;
    if (action === "view") {
      view = target.dataset.view as View;
      render();
      return;
    }
    if (action === "select") {
      if (canLeave()) {
        setDraft(state!.items.find((i) => i.id === id));
        error = "";
        render();
      }
      return;
    }
    if (action === "close") {
      if (canLeave()) {
        setDraft();
        render();
      }
      return;
    }
    if (action === "reload") {
      setDraft(state!.items.find((i) => i.id === selected));
      error = "";
      render();
      return;
    }
    if (action === "settings") {
      manager = true;
      render();
      return;
    }
    if (action === "close-settings") {
      manager = false;
      settingsDrafts.clear();
      render();
      void refresh().catch(() => undefined);
      return;
    }
    if (action === "remove-link" && draft) {
      draft.links = draft.links.filter((l) => l.id !== id);
      dirty = true;
      render();
      return;
    }
    void run(async () => {
      if (action === "refresh") await refresh(true);
      if (action === "reload-settings") {
        state = await client.snapshot();
        settingsDrafts.clear();
        error = "";
      }
      if (action === "export") {
        const blob = new Blob([await client.exportData()], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const anchor = element.ownerDocument.createElement("a");
        anchor.href = url;
        anchor.download = `budde-${new Date().toISOString().slice(0, 10)}.json`;
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        notice = "已导出完整数据；思源笔记正文不包含在导出中";
      }
      if (action === "promote") await save({ promoted: true, paused: false });
      if (action === "promote-card") {
        const item = state!.items.find((i) => i.id === id)!;
        if (dirty && selected === id) throw new Error("请先保存详情中的修改");
        await execute({
          kind: "item.update",
          id: id!,
          expectedVersion: item.version,
          patch: { promoted: true, paused: false },
        });
        if (selected === id) setDraft(state!.items.find((i) => i.id === id));
      }
      if (action === "pause" && draft) await save({ paused: !draft.paused });
      if (action === "archive" && draft)
        await save({ archived: !draft.archived });
      if (action === "review")
        await save({ reviewedAt: new Date().toISOString() });
      if (action === "open-link") {
        const link = draft?.links.find((l) => l.id === id);
        if (link) await notes.open(link.target);
      }
      if (action === "delete-type")
        await execute({
          kind: "type.delete",
          expectedRevision: state!.revision,
          id: managerType,
        });
      if (action === "stage-delete") {
        const form = target.closest("form")!;
        const migration = (
          form.elements.namedItem("target") as HTMLSelectElement
        ).value;
        await execute({
          kind: "stage.delete",
          expectedRevision: state!.revision,
          typeId: managerType,
          id: id!,
          ...(migration ? { targetId: migration } : {}),
        });
      }
      if (action === "stage-up" || action === "stage-down") {
        const ids = findType(managerType)!.stages.map((s) => s.id);
        const from = ids.indexOf(id!),
          to = from + (action === "stage-up" ? -1 : 1);
        if (to >= 0 && to < ids.length) {
          [ids[from], ids[to]] = [ids[to], ids[from]];
          await execute({
            kind: "stage.reorder",
            expectedRevision: state!.revision,
            typeId: managerType,
            ids,
          });
        }
      }
    });
  }
  function dragstart(event: DragEvent) {
    const item = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-item]",
    );
    dragging = item?.dataset.item ?? "";
    event.dataTransfer?.setData("text/plain", dragging);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
  }
  function dragover(event: DragEvent) {
    if ((event.target as HTMLElement).closest("[data-drop-stage]"))
      event.preventDefault();
  }
  function drop(event: DragEvent) {
    const lane = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-drop-stage]",
    );
    if (!lane) return;
    event.preventDefault();
    const id = dragging || event.dataTransfer?.getData("text/plain");
    dragging = "";
    const item = state?.items.find((i) => i.id === id);
    if (!item) return;
    if (item.typeId !== lane.dataset.dropType) {
      error = "跨类型移动请在详情中选择类型与阶段。";
      render();
      return;
    }
    if (dirty && selected === id) {
      error = "请先保存详情中的修改，再拖动事项。";
      render();
      return;
    }
    void run(async () => {
      await execute({
        kind: "item.update",
        id: item.id,
        expectedVersion: item.version,
        patch: { stageId: lane.dataset.dropStage },
      });
      if (selected === id) setDraft(state!.items.find((i) => i.id === id));
    });
  }
  element.addEventListener("click", click);
  element.addEventListener("submit", submit);
  element.addEventListener("input", input);
  element.addEventListener("change", change);
  element.addEventListener("dragstart", dragstart);
  element.addEventListener("dragover", dragover);
  element.addEventListener("drop", drop);
  render();
  void refresh().catch((e) => {
    error = e.message;
    render();
  });
  return {
    refresh,
    destroy() {
      destroyed = true;
      element.removeEventListener("click", click);
      element.removeEventListener("submit", submit);
      element.removeEventListener("input", input);
      element.removeEventListener("change", change);
      element.removeEventListener("dragstart", dragstart);
      element.removeEventListener("dragover", dragover);
      element.removeEventListener("drop", drop);
      element.querySelector("dialog")?.close();
      element.replaceChildren();
      element.classList.remove("budde");
    },
  };
}
