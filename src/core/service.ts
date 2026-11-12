import type {
  BuddeClient,
  BuddeState,
  Command,
  CommandResult,
  Item,
  ItemPatch,
  ItemStatus,
  ItemType,
  NoteLink,
  RequestRecord,
  StateStore,
} from "./types";
import {
  isTypeColor,
  isTypeIcon,
  isValidReviewDays,
  STAGE_TEMPLATES,
  type TypeColor,
} from "./type-config";

const MAX_REQUEST_RECORDS = 200;
const VALID_STATUSES = new Set<ItemStatus>(["pool", "active", "paused", "archived"]);

export class BuddeError extends Error {
  constructor(
    public readonly code:
      | "INVALID"
      | "NOT_FOUND"
      | "CONFLICT"
      | "REQUEST_CONFLICT"
      | "IN_USE",
    message: string,
  ) {
    super(message);
    this.name = "BuddeError";
  }
}

function fail(message: string): never {
  throw new BuddeError("INVALID", message);
}

function name(value: unknown, label = "名称", max = 120): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max)
    fail(`${label}不能为空，且不能超过 ${max} 字。`);
  return value.trim();
}

function text(value: unknown, label: string, max = 20000): string {
  if (typeof value !== "string" || value.length > max)
    fail(`${label}格式无效或内容过长。`);
  return value;
}

function object(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    fail("数据结构无效，已停止读取；原文件保持不变。");
}

function integer(value: unknown, min = 0): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < min)
    fail("数据版本或序号无效。");
}

function finiteNumber(value: unknown): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value))
    fail("排序序号无效。");
}

function bool(value: unknown): asserts value is boolean {
  if (typeof value !== "boolean") fail("状态格式无效。");
}

function date(value: unknown): asserts value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d\d-\d\dT/.test(value) ||
    !Number.isFinite(Date.parse(value))
  )
    fail("时间格式无效。");
}

function unique(values: string[], label: string): void {
  if (new Set(values).size !== values.length) fail(`${label}存在重复值。`);
}

function applyPresentation(
  type: ItemType,
  patch: {
    icon?: string | null;
    color?: TypeColor | null;
    reviewDays?: number | null;
  },
) {
  if (patch.icon !== undefined) {
    if (patch.icon === null || patch.icon === "") delete type.icon;
    else {
      if (!isTypeIcon(patch.icon)) fail("类型图标须为精选图标名称或单个 Emoji。");
      type.icon = patch.icon;
    }
  }
  if (patch.color !== undefined) {
    if (patch.color === null) delete type.color;
    else {
      if (!isTypeColor(patch.color)) fail("类型颜色无效。");
      type.color = patch.color;
    }
  }
  if (patch.reviewDays !== undefined) {
    if (!isValidReviewDays(patch.reviewDays))
      fail("复查周期须为 1–365 天或关闭提醒。");
    type.reviewDays = patch.reviewDays;
  }
}

function validateLinks(links: unknown): asserts links is NoteLink[] {
  if (!Array.isArray(links)) fail("关联格式无效。");
  for (const link of links as unknown[]) {
    object(link);
    name(link.id, "关联 ID", 200);
    text(link.title, "关联名称", 500);
    if (link.hpath !== undefined) text(link.hpath, "关联路径", 1000);
    if (
      typeof link.target !== "string" ||
      !/^(?:siyuan:\/\/blocks\/)?\d{14}-[a-z0-9]{7}$/.test(link.target)
    )
      fail("请关联有效的思源文档或块。");
    if (link.role !== "reference" && link.role !== "outcome")
      fail("关联角色无效。");
  }
  unique(
    (links as NoteLink[]).map((x) => x.id),
    "关联 ID",
  );
  unique(
    (links as NoteLink[]).map((x) => x.target.replace("siyuan://blocks/", "")),
    "关联目标",
  );
}

function upgradeLegacyV1(raw: Record<string, unknown>): BuddeState {
  integer(raw.revision);
  if (!Array.isArray(raw.types) || raw.types.length === 0 || !Array.isArray(raw.items))
    fail("类型或事项数据无效。");
  object(raw.requests);

  const items: Item[] = (raw.items as unknown[]).map((entry, index) => {
    object(entry);
    bool(entry.promoted);
    bool(entry.paused);
    bool(entry.archived);
    const status: ItemStatus = entry.archived
      ? "archived"
      : !entry.promoted
        ? "pool"
        : entry.paused
          ? "paused"
          : "active";
    return {
      id: entry.id as string,
      title: entry.title as string,
      typeId: entry.typeId as string,
      stageId: entry.stageId as string,
      status,
      pinned: false,
      order: (index + 1) * 1000,
      description: entry.description as string,
      nextStep: entry.nextStep as string,
      links: structuredClone(entry.links) as NoteLink[],
      createdAt: entry.createdAt as string,
      updatedAt: entry.updatedAt as string,
      reviewedAt: entry.reviewedAt as string | null,
      version: entry.version as number,
    };
  });

  const requests: Record<string, RequestRecord> = {};
  for (const [key, req] of Object.entries(raw.requests)) {
    object(req);
    requests[key] = {
      fingerprint: req.fingerprint as string,
      itemId: req.itemId as string,
      createdAt: typeof req.createdAt === "string" ? req.createdAt : "1970-01-01T00:00:00.000Z",
    };
  }

  return validateState({
    schemaVersion: 2,
    revision: raw.revision,
    types: structuredClone(raw.types),
    items,
    requests,
  });
}

/** Validates persisted or imported state; upgrades v1 snapshots cleanly in memory and fails closed on corruption. */
export function validateState(value: unknown): BuddeState {
  object(value);
  if (value.schemaVersion === 1) return upgradeLegacyV1(value);
  if (value.schemaVersion !== 2)
    fail("不支持的数据格式版本，请保留原文件并使用兼容版本。");
  integer(value.revision);
  if (value.defaultNotebookId !== undefined)
    text(value.defaultNotebookId, "默认笔记本 ID", 200);
  if (
    !Array.isArray(value.types) ||
    value.types.length === 0 ||
    !Array.isArray(value.items)
  )
    fail("类型或事项数据无效。");

  const stageIds: string[] = [];
  for (const type of value.types as unknown[]) {
    object(type);
    name(type.id, "类型 ID", 200);
    name(type.name);
    if (type.icon !== undefined && !isTypeIcon(type.icon))
      fail("类型图标须为精选图标名称或单个 Emoji。");
    if (type.color !== undefined && !isTypeColor(type.color))
      fail("类型颜色无效。");
    if (type.reviewDays !== undefined && !isValidReviewDays(type.reviewDays))
      fail("复查周期无效。");
    if (!Array.isArray(type.stages) || type.stages.length === 0)
      fail("每种类型至少保留一个阶段。");
    for (const stage of type.stages as unknown[]) {
      object(stage);
      name(stage.id, "阶段 ID", 200);
      name(stage.name);
      bool(stage.completed);
      stageIds.push(stage.id as string);
    }
    if (
      !(type.stages as Record<string, unknown>[]).some(
        (s) => s.id === type.initialStageId,
      )
    )
      fail("初始阶段不存在。");
  }

  const types = value.types as unknown as ItemType[];
  unique(
    types.map((t) => t.id),
    "类型 ID",
  );
  unique(stageIds, "阶段 ID");

  for (const item of value.items as unknown[]) {
    object(item);
    name(item.id, "事项 ID", 200);
    name(item.title, "标题", 500);
    const type = types.find((t) => t.id === item.typeId);
    if (!type || !type.stages.some((s) => s.id === item.stageId))
      fail("事项引用了不存在的类型或阶段。");
    if (typeof item.status !== "string" || !VALID_STATUSES.has(item.status as ItemStatus))
      fail("事项状态无效。");
    bool(item.pinned);
    finiteNumber(item.order);
    text(item.description, "说明");
    text(item.nextStep, "下一步");
    validateLinks(item.links);
    integer(item.version, 1);
    date(item.createdAt);
    date(item.updatedAt);
    if (item.reviewedAt !== null) date(item.reviewedAt);
  }

  unique(
    (value.items as Item[]).map((i) => i.id),
    "事项 ID",
  );

  object(value.requests);
  for (const [key, request] of Object.entries(value.requests)) {
    if (
      !/^[a-zA-Z0-9_-]{8,200}$/.test(key) ||
      ["__proto__", "constructor", "prototype"].includes(key)
    )
      fail("请求标识无效。");
    object(request);
    text(request.fingerprint, "请求参数", 1000);
    name(request.itemId, "请求事项 ID", 200);
    if (request.createdAt !== undefined) date(request.createdAt);
  }

  return value as unknown as BuddeState;
}

export function createInitialState(): BuddeState {
  const presets: Array<{
    id: string;
    name: string;
    icon: string;
    color: TypeColor;
    reviewDays: number;
    stages: string[];
  }> = [
    {
      id: "general",
      name: "通用",
      icon: "Lightbulb",
      color: "amber",
      reviewDays: 14,
      stages: ["想法", "准备做", "进行中", "完成"],
    },
    {
      id: "article",
      name: "文章",
      icon: "PenLine",
      color: "blue",
      reviewDays: 14,
      stages: ["选题", "写作", "修改", "已发布"],
    },
    {
      id: "software",
      name: "软件",
      icon: "Code2",
      color: "violet",
      reviewDays: 7,
      stages: ["想法", "验证", "开发", "已发布"],
    },
    {
      id: "travel",
      name: "旅行",
      icon: "Compass",
      color: "emerald",
      reviewDays: 30,
      stages: ["想去", "规划", "已预订", "已结束"],
    },
  ];

  return {
    schemaVersion: 2,
    revision: 0,
    items: [],
    requests: {},
    types: presets.map((preset) => ({
      id: preset.id,
      name: preset.name,
      icon: preset.icon,
      color: preset.color,
      reviewDays: preset.reviewDays,
      initialStageId: `${preset.id}-0`,
      stages: preset.stages.map((label, index) => ({
        id: `${preset.id}-${index}`,
        name: label,
        completed: index === preset.stages.length - 1,
      })),
    })),
  };
}

function findType(state: BuddeState, id: string): ItemType {
  const result = state.types.find((t) => t.id === id);
  if (!result)
    throw new BuddeError("NOT_FOUND", "类型已不存在，请刷新后重试。");
  return result;
}

function checkVersion(actual: number, expected: number): void {
  integer(expected);
  if (actual !== expected)
    throw new BuddeError(
      "CONFLICT",
      "内容已被其他窗口或操作修改。当前输入已保留，可选择重新读取或覆盖保存。",
    );
}

function pruneRequests(state: BuddeState, deletedItemIds?: Set<string>): void {
  if (deletedItemIds && deletedItemIds.size > 0) {
    for (const [reqId, record] of Object.entries(state.requests)) {
      if (deletedItemIds.has(record.itemId)) delete state.requests[reqId];
    }
  }
  const entries = Object.entries(state.requests);
  if (entries.length <= MAX_REQUEST_RECORDS) return;
  entries.sort((a, b) => (a[1].createdAt ?? "").localeCompare(b[1].createdAt ?? ""));
  const removeCount = entries.length - MAX_REQUEST_RECORDS;
  for (let i = 0; i < removeCount; i++) {
    delete state.requests[entries[i][0]];
  }
}

function nextTopOrder(items: Item[]): number {
  if (items.length === 0) return 1000;
  let min = Infinity;
  for (const item of items) {
    if (item.order < min) min = item.order;
  }
  return Number.isFinite(min) ? min - 1000 : 1000;
}

function normalizeOrdersIfNeeded(items: Item[]): void {
  const sorted = [...items].sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt));
  let tooClose = false;
  for (let i = 1; i < sorted.length; i++) {
    if (Math.abs(sorted[i].order - sorted[i - 1].order) < 0.001) {
      tooClose = true;
      break;
    }
  }
  if (tooClose) {
    sorted.forEach((item, index) => {
      item.order = (index + 1) * 1000;
    });
  }
}

const PATCHABLE_FIELDS = new Set([
  "title",
  "typeId",
  "stageId",
  "status",
  "pinned",
  "order",
  "description",
  "nextStep",
  "links",
  "reviewedAt",
]);

function patchItem(
  state: BuddeState,
  item: Item,
  patch: ItemPatch,
  now: string,
): void {
  object(patch);
  for (const key of Object.keys(patch)) {
    if (!PATCHABLE_FIELDS.has(key)) fail(`不支持修改字段：${key}`);
  }

  const next: Item = { ...item, ...patch };
  const targetType = findType(state, next.typeId);

  // When switching type without specifying stageId, fall back cleanly to targetType.initialStageId
  if (patch.typeId !== undefined && patch.typeId !== item.typeId && patch.stageId === undefined) {
    const wasCompleted = state.types
      .find((t) => t.id === item.typeId)
      ?.stages.find((s) => s.id === item.stageId)?.completed;
    const completedTarget = wasCompleted ? targetType.stages.find((s) => s.completed) : undefined;
    next.stageId = completedTarget ? completedTarget.id : targetType.initialStageId;
  }

  if (!targetType.stages.some((s) => s.id === next.stageId))
    fail("目标阶段不属于所选类型。");

  if (!VALID_STATUSES.has(next.status)) fail("事项状态无效。");

  // Coherence rule: moving a pool item past its initial stage (without explicitly keeping status="pool") promotes it to "active"
  if (
    item.status === "pool" &&
    patch.status === undefined &&
    next.stageId !== item.stageId &&
    next.stageId !== targetType.initialStageId
  ) {
    next.status = "active";
  }

  next.title = name(next.title, "标题", 500);
  bool(next.pinned);
  finiteNumber(next.order);
  text(next.description, "说明");
  text(next.nextStep, "下一步");
  validateLinks(next.links);
  if (next.reviewedAt !== null) date(next.reviewedAt);

  const becameActive = next.status === "active" && item.status !== "active";
  const progressed =
    next.stageId !== item.stageId || next.nextStep !== item.nextStep;
  if (patch.reviewedAt === undefined && next.status === "active" && (becameActive || progressed)) {
    next.reviewedAt = now;
  }

  Object.assign(item, next, { updatedAt: now, version: item.version + 1 });
}

export class BuddeService implements BuddeClient {
  constructor(
    private readonly store: StateStore,
    private readonly clock: () => string = () => new Date().toISOString(),
    private readonly uuid: () => string = () => crypto.randomUUID(),
  ) {}

  async snapshot(): Promise<BuddeState> {
    return structuredClone(validateState(await this.store.read()));
  }

  async hasChangedSince(mtimeMs: number): Promise<{ changed: boolean; mtimeMs: number }> {
    if (this.store.hasChangedSince) {
      return this.store.hasChangedSince(mtimeMs);
    }
    return { changed: true, mtimeMs: Date.now() };
  }

  async exportData(): Promise<string> {
    return JSON.stringify(
      {
        product: "Budde",
        exportedAt: this.clock(),
        noteContentsIncluded: false,
        data: await this.snapshot(),
      },
      null,
      2,
    );
  }

  async importData(raw: string): Promise<BuddeState> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      fail("导入文件不是有效的 JSON 格式。");
    }
    object(parsed);
    const payload =
      parsed.product === "Budde" && "data" in parsed ? parsed.data : parsed;
    const validated = validateState(structuredClone(payload));

    return this.store.transaction(
      (draft) => {
        const nextRevision = Math.max(draft.revision ?? 0, validated.revision) + 1;
        const imported: BuddeState = {
          ...validated,
          schemaVersion: 2,
          revision: nextRevision,
        };
        for (const key of Object.keys(draft)) {
          delete (draft as unknown as Record<string, unknown>)[key];
        }
        Object.assign(draft, imported);
        return structuredClone(draft);
      },
    );
  }

  async execute(command: Command): Promise<CommandResult> {
    return this.store.transaction((state) => {
      const normalized = validateState(state);
      if (state !== normalized) {
        Object.keys(state).forEach((k) => delete (state as unknown as Record<string, unknown>)[k]);
        Object.assign(state, normalized);
      }
      object(command);
      const now = this.clock();
      let itemId: string | undefined;
      let affectedCount: number | undefined;

      if (command.kind === "item.create") {
        const title = name(command.title, "标题", 500);
        if (
          typeof command.requestId !== "string" ||
          !/^[a-zA-Z0-9_-]{8,200}$/.test(command.requestId) ||
          ["__proto__", "constructor", "prototype"].includes(command.requestId)
        )
          fail("创建请求需要有效且稳定的请求标识。");

        if (command.typeId !== undefined) name(command.typeId, "类型 ID", 200);
        const status: ItemStatus = command.status === "active" ? "active" : "pool";
        const fingerprint = JSON.stringify([title, command.typeId ?? null, status]);
        const previous = Object.hasOwn(state.requests, command.requestId)
          ? state.requests[command.requestId]
          : undefined;
        if (previous) {
          if (previous.fingerprint !== fingerprint)
            throw new BuddeError(
              "REQUEST_CONFLICT",
              "同一请求标识不能用于不同的创建内容，请刷新后重试。",
            );
          if (state.items.some((i) => i.id === previous.itemId)) {
            return { state: structuredClone(state), itemId: previous.itemId };
          }
        }

        const type = findType(
          state,
          command.typeId ??
            (state.types.some((t) => t.id === "general")
              ? "general"
              : state.types[0].id),
        );
        const stageId = command.stageId ?? type.initialStageId;
        if (!type.stages.some((s) => s.id === stageId))
          fail("目标阶段不属于所选类型。");

        const links = command.links ? structuredClone(command.links) : [];
        validateLinks(links);

        itemId = this.uuid();
        state.items.unshift({
          id: itemId,
          title,
          typeId: type.id,
          stageId,
          status,
          pinned: false,
          order: nextTopOrder(state.items),
          description: command.description ? text(command.description, "说明") : "",
          nextStep: command.nextStep ? text(command.nextStep, "下一步") : "",
          links,
          createdAt: now,
          updatedAt: now,
          reviewedAt: status === "active" ? now : null,
          version: 1,
        });
        state.requests[command.requestId] = { fingerprint, itemId, createdAt: now };
        pruneRequests(state);
      } else if (command.kind === "item.update") {
        const item = state.items.find((i) => i.id === command.id);
        if (!item)
          throw new BuddeError("NOT_FOUND", "事项不存在，可能已被删除，请重新读取。");
        checkVersion(item.version, command.expectedVersion);
        patchItem(state, item, command.patch, now);
        itemId = item.id;
      } else if (command.kind === "item.delete") {
        const index = state.items.findIndex((i) => i.id === command.id);
        if (index < 0)
          throw new BuddeError("NOT_FOUND", "事项不存在或已删除。");
        if (command.expectedVersion !== undefined) {
          checkVersion(state.items[index].version, command.expectedVersion);
        }
        const [removed] = state.items.splice(index, 1);
        pruneRequests(state, new Set([removed.id]));
        itemId = removed.id;
        affectedCount = 1;
      } else if (command.kind === "item.reorder") {
        const item = state.items.find((i) => i.id === command.id);
        if (!item)
          throw new BuddeError("NOT_FOUND", "事项不存在，请重新读取。");
        const type = findType(state, item.typeId);
        const nextStageId = command.stageId ?? item.stageId;
        if (!type.stages.some((s) => s.id === nextStageId))
          fail("目标阶段不属于所选类型。");

        const before = command.beforeId
          ? state.items.find((i) => i.id === command.beforeId)
          : undefined;
        const after = command.afterId
          ? state.items.find((i) => i.id === command.afterId)
          : undefined;

        let newOrder = item.order;
        if (before && after && before.id !== after.id) {
          newOrder = (after.order + before.order) / 2;
        } else if (before) {
          newOrder = before.order - 500;
        } else if (after) {
          newOrder = after.order + 500;
        } else if (nextStageId !== item.stageId) {
          const peers = state.items.filter(
            (i) => i.id !== item.id && i.typeId === item.typeId && i.stageId === nextStageId,
          );
          newOrder = peers.length
            ? Math.max(...peers.map((p) => p.order)) + 1000
            : 1000;
        }

        const stageChanged = nextStageId !== item.stageId;
        item.stageId = nextStageId;
        item.order = newOrder;
        if (item.status === "pool" && stageChanged) {
          item.status = "active";
          item.reviewedAt = now;
        } else if (item.status === "active" && stageChanged) {
          item.reviewedAt = now;
        }
        item.updatedAt = now;
        item.version += 1;
        normalizeOrdersIfNeeded(state.items);
        itemId = item.id;
      } else if (command.kind === "items.archiveCompleted") {
        checkVersion(state.revision, command.expectedRevision);
        let count = 0;
        for (const item of state.items) {
          if (item.status === "archived") continue;
          if (command.typeId && item.typeId !== command.typeId) continue;
          const type = state.types.find((t) => t.id === item.typeId);
          const stage = type?.stages.find((s) => s.id === item.stageId);
          if (stage?.completed && item.status === "active") {
            item.status = "archived";
            item.updatedAt = now;
            item.version += 1;
            count += 1;
          }
        }
        affectedCount = count;
        if (count === 0) return { state: structuredClone(state), affectedCount: 0 };
      } else if (command.kind === "items.purgeArchived") {
        checkVersion(state.revision, command.expectedRevision);
        const removedIds = new Set<string>();
        state.items = state.items.filter((item) => {
          const shouldRemove =
            item.status === "archived" &&
            (!command.typeId || item.typeId === command.typeId);
          if (shouldRemove) removedIds.add(item.id);
          return !shouldRemove;
        });
        pruneRequests(state, removedIds);
        affectedCount = removedIds.size;
        if (removedIds.size === 0) return { state: structuredClone(state), affectedCount: 0 };
      } else if (command.kind === "item.syncNoteTitles") {
        let changed = false;
        for (const item of state.items) {
          for (const link of item.links) {
            const rawId = link.target.replace("siyuan://blocks/", "");
            const fresh = command.titles[rawId] ?? command.titles[link.target];
            if (fresh && fresh.title && (fresh.title !== link.title || fresh.hpath !== link.hpath)) {
              link.title = text(fresh.title, "关联名称", 500);
              if (fresh.hpath !== undefined) link.hpath = text(fresh.hpath, "关联路径", 1000);
              changed = true;
            }
          }
        }
        if (!changed) return { state: structuredClone(state), affectedCount: 0 };
      } else if (command.kind === "preference.setNotebook") {
        const nb = text(command.notebookId, "默认笔记本 ID", 200).trim();
        if (state.defaultNotebookId === nb) {
          return { state: structuredClone(state) };
        }
        if (nb) state.defaultNotebookId = nb;
        else delete state.defaultNotebookId;
      } else {
        if (!("expectedRevision" in command)) fail("命令无效。");
        checkVersion(state.revision, command.expectedRevision);

        if (command.kind === "type.create") {
          const template = command.template === undefined ? "basic" : command.template;
          if (typeof template !== "string" || !Object.hasOwn(STAGE_TEMPLATES, template))
            fail("阶段模板无效。");
          const preset = STAGE_TEMPLATES[template];
          const id = this.uuid();
          const stages = preset.stages.map((stage) => ({ ...stage, id: this.uuid() }));
          const type: ItemType = {
            id,
            name: name(command.name),
            initialStageId: stages[0].id,
            stages,
            icon: preset.defaultIcon,
            color: preset.defaultColor,
            reviewDays: preset.defaultReviewDays,
          };
          applyPresentation(type, command);
          state.types.push(type);
        } else if (command.kind === "type.update") {
          const type = findType(state, command.id);
          type.name = name(command.name);
          applyPresentation(type, command);
          if (command.initialStageId !== undefined) {
            if (!type.stages.some((s) => s.id === command.initialStageId))
              fail("初始阶段不存在。");
            type.initialStageId = command.initialStageId;
          }
        } else if (command.kind === "type.reorder") {
          if (
            !Array.isArray(command.ids) ||
            command.ids.length !== state.types.length ||
            new Set(command.ids).size !== command.ids.length ||
            command.ids.some((id) => !state.types.some((t) => t.id === id))
          )
            fail("类型排序必须包含原有的全部类型，且不能重复。");
          state.types = command.ids.map((id) => state.types.find((t) => t.id === id)!);
        } else if (command.kind === "type.delete") {
          const sourceType = findType(state, command.id);
          if (state.types.length === 1) fail("至少保留一种类型。");
          const affected = state.items.filter((i) => i.typeId === sourceType.id);
          if (affected.length > 0) {
            if (!command.targetTypeId || command.targetTypeId === sourceType.id) {
              throw new BuddeError(
                "IN_USE",
                "该类型下仍有事项（包括归档事项），请选择迁移目标类型。",
              );
            }
            const targetType = findType(state, command.targetTypeId);
            const targetCompletedStage = targetType.stages.find((s) => s.completed);
            for (const item of affected) {
              const wasCompleted = sourceType.stages.find((s) => s.id === item.stageId)?.completed;
              const mappedStageId =
                wasCompleted && targetCompletedStage
                  ? targetCompletedStage.id
                  : targetType.initialStageId;
              patchItem(
                state,
                item,
                { typeId: targetType.id, stageId: mappedStageId },
                now,
              );
            }
            affectedCount = affected.length;
          }
          state.types = state.types.filter((t) => t.id !== sourceType.id);
        } else if (command.kind === "stage.add") {
          findType(state, command.typeId).stages.push({
            id: this.uuid(),
            name: name(command.name),
            completed: Boolean(command.completed),
          });
        } else if (command.kind === "stage.update") {
          const stage = findType(state, command.typeId).stages.find(
            (s) => s.id === command.id,
          );
          if (!stage) throw new BuddeError("NOT_FOUND", "阶段不存在。");
          bool(command.completed);
          stage.name = name(command.name);
          stage.completed = command.completed;
        } else if (command.kind === "stage.delete") {
          const type = findType(state, command.typeId);
          if (!type.stages.some((s) => s.id === command.id))
            throw new BuddeError("NOT_FOUND", "阶段不存在。");
          if (type.stages.length === 1) fail("每种类型至少保留一个阶段。");
          const affected = state.items.filter(
            (i) => i.typeId === type.id && i.stageId === command.id,
          );
          const target = type.stages.find(
            (s) => s.id === command.targetId && s.id !== command.id,
          );
          if ((affected.length || type.initialStageId === command.id) && !target)
            fail("删除此阶段前，请选择有效的迁移目标阶段。");
          for (const item of affected) {
            patchItem(state, item, { stageId: target!.id }, now);
          }
          if (type.initialStageId === command.id) {
            type.initialStageId = target!.id;
          }
          type.stages = type.stages.filter((s) => s.id !== command.id);
          affectedCount = affected.length;
        } else if (command.kind === "stage.reorder") {
          const type = findType(state, command.typeId);
          if (
            !Array.isArray(command.ids) ||
            command.ids.length !== type.stages.length ||
            new Set(command.ids).size !== command.ids.length ||
            command.ids.some((id) => !type.stages.some((s) => s.id === id))
          )
            fail("阶段排序必须包含原有的全部阶段，且不能重复。");
          type.stages = command.ids.map((id) => type.stages.find((s) => s.id === id)!);
        } else {
          fail("不支持的操作。");
        }
      }

      state.revision += 1;
      validateState(state);
      return {
        state: structuredClone(state),
        ...(itemId ? { itemId } : {}),
        ...(affectedCount !== undefined ? { affectedCount } : {}),
      };
    });
  }
}

/** Only for isolated tests and the development harness, never production storage. */
export class MemoryStore implements StateStore {
  private state: BuddeState;
  private mtime = 1;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(initial: unknown = createInitialState()) {
    this.state = structuredClone(validateState(initial));
  }

  async read(): Promise<BuddeState> {
    await this.queue;
    return structuredClone(this.state);
  }

  async hasChangedSince(mtimeMs: number): Promise<{ changed: boolean; mtimeMs: number }> {
    await this.queue;
    return { changed: this.mtime !== mtimeMs, mtimeMs: this.mtime };
  }

  transaction<T>(mutate: (draft: BuddeState) => T): Promise<T> {
    const operation = this.queue.then(() => {
      const draft = structuredClone(this.state);
      const before = JSON.stringify(draft);
      const result = mutate(draft);
      const validated = validateState(draft);
      if (JSON.stringify(validated) !== before) {
        this.mtime += 1;
      }
      this.state = validated;
      return result;
    });
    this.queue = operation.catch(() => undefined);
    return operation;
  }
}
