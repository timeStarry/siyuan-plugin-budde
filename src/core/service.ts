import type {
  BuddeClient,
  BuddeState,
  Command,
  CommandResult,
  Item,
  ItemPatch,
  ItemType,
  StateStore,
} from "./types";

import { isTypeColor, isTypeIcon, STAGE_TEMPLATES } from "./type-config";

function applyPresentation(type: ItemType, patch: { icon?: string | null; color?: ItemType["color"] | null }) {
  if (patch.icon !== undefined) {
    if (patch.icon === null) delete type.icon;
    else { if (!isTypeIcon(patch.icon)) fail("类型图标须为精选图标名称或单个 Emoji。"); type.icon = patch.icon; }
  }
  if (patch.color !== undefined) {
    if (patch.color === null) delete type.color;
    else { if (!isTypeColor(patch.color)) fail("类型颜色无效。"); type.color = patch.color; }
  }
}

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
const fail = (message: string): never => {
  throw new BuddeError("INVALID", message);
};
function name(value: unknown, label = "名称", max = 120): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max)
    fail(`${label}不能为空，且不能超过 ${max} 字。`);
  return (value as string).trim();
}
function text(value: unknown, label: string, max = 20000): string {
  if (typeof value !== "string" || value.length > max)
    fail(`${label}格式无效或内容过长。`);
  return value as string;
}
function object(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    fail("数据结构无效，已停止读取；原文件保持不变。");
}
function integer(value: unknown, min = 0): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < min)
    fail("数据版本或序号无效。");
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
function validateLinks(links: unknown): asserts links is Item["links"] {
  if (!Array.isArray(links)) fail("关联格式无效。");
  for (const link of links as unknown[]) {
    object(link);
    name(link.id, "关联 ID", 200);
    text(link.title, "关联名称", 500);
    if (
      typeof link.target !== "string" ||
      !/^(?:siyuan:\/\/blocks\/)?\d{14}-[a-z0-9]{7}$/.test(link.target)
    )
      fail("请关联有效的思源文档或块。");
    if (link.role !== "reference" && link.role !== "outcome")
      fail("关联角色无效。");
  }
  unique(
    (links as Item["links"]).map((x) => x.id),
    "关联 ID",
  );
  unique(
    (links as Item["links"]).map((x) =>
      x.target.replace("siyuan://blocks/", ""),
    ),
    "关联目标",
  );
}

/** Validates before using persisted data. Never silently resets a corrupt or newer file. */
export function validateState(value: unknown): BuddeState {
  object(value);
  if (value.schemaVersion !== 1)
    fail("不支持的数据格式版本，请保留原文件并使用兼容版本。");
  integer(value.revision);
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
    if (type.icon !== undefined && !isTypeIcon(type.icon)) fail("类型图标须为精选图标名称或单个 Emoji。");
    if (type.color !== undefined && !isTypeColor(type.color)) fail("类型颜色无效。");
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
    text(item.description, "说明");
    text(item.nextStep, "下一步");
    validateLinks(item.links);
    bool(item.promoted);
    bool(item.paused);
    bool(item.archived);
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
    if (!(value.items as Item[]).some((i) => i.id === request.itemId))
      fail("创建请求对应的事项不存在。");
  }
  return value as unknown as BuddeState;
}

export function createInitialState(): BuddeState {
  const presets = [
    ["general", "通用", "想法", "准备做", "进行中", "完成"],
    ["article", "文章", "选题", "写作", "修改", "已发布"],
    ["software", "软件", "想法", "验证", "开发", "已发布"],
    ["travel", "旅行", "想去", "规划", "已预订", "已结束"],
  ];
  return {
    schemaVersion: 1,
    revision: 0,
    items: [],
    requests: {},
    types: presets.map(([id, label, ...stages]) => ({
      id,
      name: label,
      initialStageId: `${id}-0`,
      stages: stages.map((label, index) => ({
        id: `${id}-${index}`,
        name: label,
        completed: index === stages.length - 1,
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
      "内容已被其他窗口或操作修改。你的输入已保留，请重新读取后决定如何保存。",
    );
}
const fields = new Set([
  "title",
  "typeId",
  "stageId",
  "description",
  "nextStep",
  "links",
  "promoted",
  "paused",
  "archived",
  "reviewedAt",
]);
function patchItem(
  state: BuddeState,
  item: Item,
  patch: ItemPatch,
  now: string,
): void {
  object(patch);
  for (const key of Object.keys(patch))
    if (!fields.has(key)) fail(`不支持修改字段：${key}`);
  if (
    "typeId" in patch &&
    patch.typeId !== item.typeId &&
    !("stageId" in patch)
  )
    fail("改变类型时请明确选择目标阶段。");
  const next = { ...item, ...patch };
  const type = findType(state, next.typeId);
  if (!type.stages.some((s) => s.id === next.stageId))
    fail("目标阶段不属于所选类型。");
  next.title = name(next.title, "标题", 500);
  text(next.description, "说明");
  text(next.nextStep, "下一步");
  validateLinks(next.links);
  bool(next.promoted);
  bool(next.paused);
  bool(next.archived);
  if (next.reviewedAt !== null) date(next.reviewedAt);
  if (
    (next.promoted && !item.promoted) ||
    next.stageId !== item.stageId ||
    next.nextStep !== item.nextStep
  ) {
    if (next.promoted) next.reviewedAt = now;
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
  async execute(command: Command): Promise<CommandResult> {
    return this.store.transaction((state) => {
      validateState(state);
      object(command);
      const now = this.clock();
      let itemId: string | undefined;
      if (command.kind === "item.create") {
        const title = name(command.title, "标题", 500);
        if (
          typeof command.requestId !== "string" ||
          !/^[a-zA-Z0-9_-]{8,200}$/.test(command.requestId) ||
          ["__proto__", "constructor", "prototype"].includes(command.requestId)
        )
          fail("创建请求需要有效且稳定的请求标识。");
        if (command.typeId !== undefined) name(command.typeId, "类型 ID", 200);
        // Retry recognition must not depend on a type/default that may have changed.
        const fingerprint = JSON.stringify([title, command.typeId ?? null]);
        const previous = Object.hasOwn(state.requests, command.requestId)
          ? state.requests[command.requestId]
          : undefined;
        if (previous) {
          if (previous.fingerprint !== fingerprint)
            throw new BuddeError(
              "REQUEST_CONFLICT",
              "同一请求标识不能用于不同的创建内容，请刷新请求后重试。",
            );
          return { state: structuredClone(state), itemId: previous.itemId };
        }
        const type = findType(
          state,
          command.typeId ??
            (state.types.some((t) => t.id === "general")
              ? "general"
              : state.types[0].id),
        );
        itemId = this.uuid();
        state.items.unshift({
          id: itemId,
          title,
          typeId: type.id,
          stageId: type.initialStageId,
          description: "",
          nextStep: "",
          links: [],
          promoted: false,
          paused: false,
          archived: false,
          createdAt: now,
          updatedAt: now,
          reviewedAt: null,
          version: 1,
        });
        state.requests[command.requestId] = { fingerprint, itemId };
      } else if (command.kind === "item.update") {
        const item = state.items.find((i) => i.id === command.id);
        if (!item)
          throw new BuddeError("NOT_FOUND", "事项不存在，请重新读取。");
        checkVersion(item.version, command.expectedVersion);
        patchItem(state, item, command.patch, now);
        itemId = item.id;
      } else {
        if (!("expectedRevision" in command)) fail("命令无效。");
        checkVersion(state.revision, command.expectedRevision);
        if (command.kind === "type.create") {
          const template = command.template === undefined ? "basic" : command.template;
          if (typeof template !== "string" || !Object.hasOwn(STAGE_TEMPLATES, template)) fail("阶段模板无效。");
          const id = this.uuid();
          const stages = STAGE_TEMPLATES[template].stages.map(stage => ({ ...stage, id: this.uuid() }));
          const type: ItemType = { id, name: name(command.name), initialStageId: stages[0].id, stages };
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
        } else if (command.kind === "type.delete") {
          findType(state, command.id);
          if (state.types.length === 1) fail("至少保留一种类型。");
          if (state.items.some((i) => i.typeId === command.id))
            throw new BuddeError(
              "IN_USE",
              "该类型仍有事项（包括归档事项），请先迁移事项。",
            );
          state.types = state.types.filter((t) => t.id !== command.id);
        } else if (command.kind === "stage.add") {
          findType(state, command.typeId).stages.push({
            id: this.uuid(),
            name: name(command.name),
            completed: false,
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
          if (
            (affected.length || type.initialStageId === command.id) &&
            !target
          )
            fail("删除此阶段前，请选择有效的迁移目标阶段。");
          for (const item of affected)
            patchItem(state, item, { stageId: target!.id }, now);
          if (type.initialStageId === command.id)
            type.initialStageId = target!.id;
          type.stages = type.stages.filter((s) => s.id !== command.id);
        } else if (command.kind === "stage.reorder") {
          const type = findType(state, command.typeId);
          if (
            !Array.isArray(command.ids) ||
            command.ids.length !== type.stages.length ||
            new Set(command.ids).size !== command.ids.length ||
            command.ids.some((id) => !type.stages.some((s) => s.id === id))
          )
            fail("阶段排序必须包含原有的全部阶段，且不能重复。");
          type.stages = command.ids.map(
            (id) => type.stages.find((s) => s.id === id)!,
          );
        } else fail("不支持的操作。");
      }
      state.revision += 1;
      validateState(state);
      return { state: structuredClone(state), ...(itemId ? { itemId } : {}) };
    });
  }
}

/** Only for isolated tests and the development harness, never production storage. */
export class MemoryStore implements StateStore {
  private state: BuddeState;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(initial = createInitialState()) {
    this.state = structuredClone(validateState(initial));
  }
  async read(): Promise<BuddeState> {
    await this.queue;
    return structuredClone(this.state);
  }
  transaction<T>(mutate: (draft: BuddeState) => T): Promise<T> {
    const operation = this.queue.then(() => {
      const draft = structuredClone(this.state);
      const result = mutate(draft);
      validateState(draft);
      this.state = draft;
      return result;
    });
    this.queue = operation.catch(() => undefined);
    return operation;
  }
}
