import type { Item, ItemType, Stage, TypePack } from "./types";
import { isTypeColor, isTypeIcon, isValidReviewDays } from "./type-config";

/** Renders a type's Markdown template, stripping empty callout/bullet placeholders cleanly. */
export function renderDocTemplate(
  template: string,
  context: {
    item: Pick<Item, "title" | "description" | "nextStep">;
    type: Pick<ItemType, "name">;
    stage: Pick<Stage, "name">;
    date?: string;
  },
): string {
  const dateStr = context.date ?? new Date().toISOString().slice(0, 10);
  const desc = context.item.description.trim();
  const next = context.item.nextStep.trim();

  const lines = template.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];

  for (const rawLine of lines) {
    if (!desc && /^\s*>\s*\{\{description\}\}\s*$/.test(rawLine)) {
      continue;
    }
    if (!next && /^\s*(?:-\s*(?:\[[ xX]\]\s*)?)?(?:下一步[:：]\s*)?\{\{nextStep\}\}\s*$/.test(rawLine)) {
      continue;
    }
    const replaced = rawLine
      .replace(/\{\{title\}\}/g, context.item.title)
      .replace(/\{\{description\}\}/g, desc ? desc.replace(/\n/g, "\n> ") : "")
      .replace(/\{\{nextStep\}\}/g, next)
      .replace(/\{\{type\}\}/g, context.type.name)
      .replace(/\{\{stage\}\}/g, context.stage.name)
      .replace(/\{\{date\}\}/g, dateStr);
    out.push(replaced);
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function normalizeHeadingForStageMatch(text: string): string {
  return text.replace(/\s+/g, "").trim().toLocaleLowerCase();
}

export function createTypePack(
  type: ItemType,
  now = new Date().toISOString(),
): TypePack {
  const initialIndex = Math.max(
    0,
    type.stages.findIndex((stage) => stage.id === type.initialStageId),
  );
  return {
    product: "BuddeTypePack",
    schemaVersion: 1,
    exportedAt: now,
    type: {
      name: type.name,
      ...(type.icon ? { icon: type.icon } : {}),
      ...(type.color ? { color: type.color } : {}),
      ...(type.reviewDays !== undefined ? { reviewDays: type.reviewDays } : {}),
      ...(type.docTemplate !== undefined ? { docTemplate: type.docTemplate } : {}),
      initialStageIndex: initialIndex,
      stages: type.stages.map((stage) => ({
        name: stage.name,
        completed: stage.completed,
        ...(stage.criteria?.length
          ? { criteria: stage.criteria.map((c) => c.text) }
          : {}),
      })),
    },
  };
}

export function parseTypePack(raw: string): TypePack {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("导入文件不是有效的 JSON 格式。");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("导入文件格式无效。");
  }
  const obj = parsed as Record<string, unknown>;
  if (obj.product !== "BuddeTypePack" || obj.schemaVersion !== 1 || !obj.type || typeof obj.type !== "object") {
    throw new Error("请选择通过「导出此类型」生成的 Budde 类型配置包（.json）。");
  }

  const rawType = obj.type as Record<string, unknown>;
  if (typeof rawType.name !== "string" || !rawType.name.trim() || rawType.name.trim().length > 120) {
    throw new Error("类型配置包中的类型名称无效。");
  }
  if (rawType.icon !== undefined && !isTypeIcon(rawType.icon)) {
    throw new Error("类型配置包中的图标无效。");
  }
  if (rawType.color !== undefined && !isTypeColor(rawType.color)) {
    throw new Error("类型配置包中的颜色无效。");
  }
  if (rawType.reviewDays !== undefined && !isValidReviewDays(rawType.reviewDays)) {
    throw new Error("类型配置包中的复查周期无效。");
  }
  if (
    rawType.docTemplate !== undefined &&
    (typeof rawType.docTemplate !== "string" || rawType.docTemplate.length > 20000)
  ) {
    throw new Error("类型配置包中的文档模板内容无效或过长。");
  }
  if (!Array.isArray(rawType.stages) || rawType.stages.length === 0) {
    throw new Error("类型配置包至少包含一个阶段。");
  }

  const stages = rawType.stages.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error("类型配置包中的阶段条目无效。");
    }
    const stage = entry as Record<string, unknown>;
    if (typeof stage.name !== "string" || !stage.name.trim() || stage.name.trim().length > 120) {
      throw new Error("类型配置包中的阶段名称无效。");
    }
    if (typeof stage.completed !== "boolean") {
      throw new Error("类型配置包中的阶段完成标记无效。");
    }
    let criteria: string[] | undefined;
    if (stage.criteria !== undefined) {
      if (!Array.isArray(stage.criteria) || stage.criteria.length > 20) {
        throw new Error("类型配置包中的阶段准出清单格式无效。");
      }
      criteria = stage.criteria.map((c) => {
        if (typeof c !== "string" || !c.trim() || c.trim().length > 200) {
          throw new Error("类型配置包中的准出检查项须为 1–200 字的非空文本。");
        }
        return c.trim();
      });
    }
    return {
      name: stage.name.trim(),
      completed: stage.completed,
      ...(criteria?.length ? { criteria } : {}),
    };
  });

  const initialStageIndex =
    typeof rawType.initialStageIndex === "number" &&
    Number.isSafeInteger(rawType.initialStageIndex) &&
    rawType.initialStageIndex >= 0 &&
    rawType.initialStageIndex < stages.length
      ? rawType.initialStageIndex
      : 0;

  return {
    product: "BuddeTypePack",
    schemaVersion: 1,
    exportedAt: typeof obj.exportedAt === "string" ? obj.exportedAt : new Date().toISOString(),
    type: {
      name: rawType.name.trim(),
      ...(rawType.icon ? { icon: rawType.icon } : {}),
      ...(rawType.color ? { color: rawType.color } : {}),
      ...(rawType.reviewDays !== undefined ? { reviewDays: rawType.reviewDays } : {}),
      ...(rawType.docTemplate !== undefined ? { docTemplate: rawType.docTemplate } : {}),
      initialStageIndex,
      stages,
    },
  };
}
