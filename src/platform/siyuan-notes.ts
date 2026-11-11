import type { NoteBridge } from "../core/types";

const ID = "[0-9]{14}-[a-z0-9]{7}";
export function parseNoteId(input: string): string {
  const target = input.trim();
  const raw = target.match(new RegExp(`^(${ID})$`));
  const url = target.match(new RegExp(`^siyuan://blocks/(${ID})/?$`));
  const reference = target.match(
    new RegExp(`^\\(\\((${ID})(?:\\s+(?:'[^']*'|\"[^\"]*\"))?\\)\\)$`),
  );
  const id = raw?.[1] ?? url?.[1] ?? reference?.[1];
  if (!id) throw new Error("请输入思源块 ID、思源链接或块引用。");
  return id;
}

/** Uses the existing local renderer session; no API token is stored or requested. */
export class SiYuanNotes implements NoteBridge {
  constructor(
    private readonly openBlock: (id: string) => void | Promise<void>,
    private readonly request: typeof fetch = globalThis.fetch.bind(globalThis),
  ) {}

  async resolve(target: string): Promise<{ target: string; title: string }> {
    const id = parseNoteId(target);
    const response = await this.request("/api/query/sql", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stmt: `SELECT id, content FROM blocks WHERE id = '${id}' LIMIT 1`,
      }),
    });
    if (!response.ok)
      throw new Error("无法读取关联笔记，请检查思源连接后重试。");
    const result = (await response.json()) as {
      code?: number;
      data?: { id: string; content: string }[];
    };
    if (result.code !== 0)
      throw new Error("读取关联笔记失败，请检查思源访问权限。");
    const row = result.data?.[0];
    if (!row || row.id !== id)
      throw new Error("关联笔记不存在或当前不可访问，已保留原关联。");
    return {
      target: `siyuan://blocks/${id}`,
      title: row.content.trim().slice(0, 160) || id,
    };
  }

  async open(target: string, signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) return;
    const id = parseNoteId(target);
    // Recheck existence to give a useful error for deleted or unavailable notes.
    await this.resolve(id);
    // A tab closed during lookup must not reopen/focus the host after teardown.
    if (signal?.aborted) return;
    await this.openBlock(id);
  }
}
