import type { NoteBridge, NotebookSummary, NoteSummary } from "../core/types";

const ID_PATTERN = "[0-9]{14}-[a-z0-9]{7}";

export function tryParseNoteId(input: string): string | null {
  const target = input.trim();
  if (!target) return null;
  const raw = target.match(new RegExp(`^(${ID_PATTERN})$`));
  if (raw?.[1]) return raw[1];
  const url = target.match(new RegExp(`^siyuan://blocks/(${ID_PATTERN})/?$`));
  if (url?.[1]) return url[1];
  const reference = target.match(
    new RegExp(`^\\(\\((${ID_PATTERN})(?:\\s+(?:'[^']*'|\"[^\"]*\"))?\\)\\)$`),
  );
  return reference?.[1] ?? null;
}

export function parseNoteId(input: string): string {
  const id = tryParseNoteId(input);
  if (!id) throw new Error("请输入有效的思源块 ID、思源链接或块引用。");
  return id;
}

function escapeSql(value: string): string {
  return value.replace(/[\0\r\n]/g, " ").replace(/'/g, "''");
}

function escapeLike(value: string): string {
  return escapeSql(value).replace(/[%_\\]/g, (ch) => `\\${ch}`);
}

function formatBlockTitle(row: { id: string; content?: string; name?: string; hpath?: string }): string {
  const raw = (row.content || row.name || "").replace(/\s+/g, " ").trim();
  if (raw) return raw.slice(0, 160);
  if (row.hpath) {
    const leaf = row.hpath.split("/").filter(Boolean).at(-1)?.trim();
    if (leaf) return leaf.slice(0, 160);
  }
  return row.id;
}

/** Uses the existing local renderer session; no API token is stored or requested. */
export class SiYuanNotes implements NoteBridge {
  constructor(
    private readonly openBlock: (id: string) => void | Promise<void>,
    private readonly request: typeof fetch = globalThis.fetch.bind(globalThis),
  ) {}

  private async postJson<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
    const response = await this.request(url, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      ...(signal ? { signal } : {}),
    });
    if (!response.ok) {
      throw new Error("无法连接思源本地服务，请检查思源状态后重试。");
    }
    const result = (await response.json()) as {
      code?: number;
      msg?: string;
      data?: T;
    };
    if (result.code !== 0) {
      throw new Error(result.msg || "思源接口返回异常，请检查访问权限。");
    }
    return result.data as T;
  }

  async resolve(target: string): Promise<{ id: string; target: string; title: string; hpath?: string }> {
    const id = parseNoteId(target);
    const rows = await this.postJson<
      Array<{ id: string; content?: string; name?: string; hpath?: string; type?: string }>
    >("/api/query/sql", {
      stmt: `SELECT id, content, name, hpath, type FROM blocks WHERE id = '${id}' LIMIT 1`,
    });
    const row = rows?.[0];
    if (!row || row.id !== id) {
      throw new Error("关联笔记不存在或当前不可访问。");
    }
    return {
      id,
      target: `siyuan://blocks/${id}`,
      title: formatBlockTitle(row),
      ...(row.hpath ? { hpath: row.hpath } : {}),
    };
  }

  async search(query: string, signal?: AbortSignal): Promise<NoteSummary[]> {
    const trimmed = query.trim();
    const directId = tryParseNoteId(trimmed);
    if (directId) {
      const rows = await this.postJson<
        Array<{ id: string; content?: string; name?: string; hpath?: string; type?: string }>
      >(
        "/api/query/sql",
        {
          stmt: `SELECT id, content, name, hpath, type FROM blocks WHERE id = '${directId}' LIMIT 1`,
        },
        signal,
      );
      if (!rows?.length) return [];
      const row = rows[0];
      return [
        {
          id: row.id,
          target: `siyuan://blocks/${row.id}`,
          title: formatBlockTitle(row),
          ...(row.hpath ? { hpath: row.hpath } : {}),
          isDoc: row.type === "d",
        },
      ];
    }

    const stmt = trimmed
      ? `SELECT id, content, name, hpath, type FROM blocks WHERE type IN ('d', 'h', 'p') AND (content LIKE '%${escapeLike(trimmed)}%' ESCAPE '\\' OR hpath LIKE '%${escapeLike(trimmed)}%' ESCAPE '\\' OR name LIKE '%${escapeLike(trimmed)}%' ESCAPE '\\') ORDER BY CASE WHEN type = 'd' THEN 0 WHEN type = 'h' THEN 1 ELSE 2 END, updated DESC LIMIT 20`
      : `SELECT id, content, name, hpath, type FROM blocks WHERE type = 'd' ORDER BY updated DESC LIMIT 12`;

    const rows =
      (await this.postJson<
        Array<{ id: string; content?: string; name?: string; hpath?: string; type?: string }>
      >("/api/query/sql", { stmt }, signal)) ?? [];

    return rows
      .filter((row) => typeof row.id === "string" && tryParseNoteId(row.id) !== null)
      .map((row) => ({
        id: row.id,
        target: `siyuan://blocks/${row.id}`,
        title: formatBlockTitle(row),
        ...(row.hpath ? { hpath: row.hpath } : {}),
        isDoc: row.type === "d",
      }));
  }

  async listNotebooks(signal?: AbortSignal): Promise<NotebookSummary[]> {
    const data = await this.postJson<{
      notebooks?: Array<{ id: string; name: string; closed?: boolean }>;
    }>("/api/notebook/lsNotebooks", {}, signal);
    return (data?.notebooks ?? [])
      .filter((nb) => !nb.closed && nb.id && nb.name)
      .map((nb) => ({ id: nb.id, name: nb.name }));
  }

  async createDoc(
    options: { notebookId: string; title: string; markdown: string },
    signal?: AbortSignal,
  ): Promise<{ id: string; target: string; title: string; hpath?: string }> {
    const notebook = options.notebookId.trim();
    if (!notebook) throw new Error("请先选择用于存放文档的思源笔记本。");
    const safeTitle =
      options.title
        .replace(/[\\/:*?"<>|]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 120) || "未命名事项";
    const docPath = `/${safeTitle}`;
    const createdId = await this.postJson<string>(
      "/api/filetree/createDocWithMd",
      {
        notebook,
        path: docPath,
        markdown: options.markdown,
      },
      signal,
    );
    const validId = typeof createdId === "string" ? tryParseNoteId(createdId) : null;
    if (!validId) {
      throw new Error("思源创建文档失败，未返回有效的文档 ID。");
    }
    return {
      id: validId,
      target: `siyuan://blocks/${validId}`,
      title: safeTitle,
      hpath: docPath,
    };
  }

  async resolveMany(
    targets: string[],
    signal?: AbortSignal,
  ): Promise<Record<string, { title: string; hpath?: string }>> {
    const ids = Array.from(
      new Set(targets.map((t) => tryParseNoteId(t)).filter((id): id is string => Boolean(id))),
    );
    if (ids.length === 0) return {};
    const quoted = ids.map((id) => `'${id}'`).join(", ");
    const rows =
      (await this.postJson<
        Array<{ id: string; content?: string; name?: string; hpath?: string }>
      >(
        "/api/query/sql",
        {
          stmt: `SELECT id, content, name, hpath FROM blocks WHERE id IN (${quoted})`,
        },
        signal,
      )) ?? [];
    const map: Record<string, { title: string; hpath?: string }> = {};
    for (const row of rows) {
      if (row.id) {
        map[row.id] = {
          title: formatBlockTitle(row),
          ...(row.hpath ? { hpath: row.hpath } : {}),
        };
      }
    }
    return map;
  }

  async readDocMarkdown(
    id: string,
    signal?: AbortSignal,
  ): Promise<{ id: string; title: string; markdown: string }> {
    const validId = parseNoteId(id);
    const data = await this.postJson<{ hPath?: string; content?: string }>(
      "/api/export/exportMdContent",
      { id: validId },
      signal,
    );
    const markdown = typeof data?.content === "string" ? data.content : "";
    const leaf = data?.hPath?.split("/").filter(Boolean).at(-1)?.trim();
    return {
      id: validId,
      title: leaf || validId,
      markdown,
    };
  }

  async getDocHeadings(
    docId: string,
    signal?: AbortSignal,
  ): Promise<Array<{ id: string; content: string }>> {
    const validId = parseNoteId(docId);
    const normalizeHeading = (raw?: string) =>
      String(raw ?? "")
        .replace(/<[^>]*>/g, "")
        .replace(/^#+\s*/, "")
        .replace(/\s+/g, " ")
        .trim();

    try {
      const children =
        (await this.postJson<Array<{ id?: string; type?: string; content?: string }>>(
          "/api/block/getChildBlocks",
          { id: validId },
          signal,
        )) ?? [];
      const childHeadings = children
        .filter((row) => row.type === "h" && typeof row.id === "string" && tryParseNoteId(row.id))
        .map((row) => ({
          id: row.id as string,
          content: normalizeHeading(row.content),
        }))
        .filter((h) => Boolean(h.content));
      if (childHeadings.length > 0) return childHeadings;
    } catch {
      // Fall back to SQL query if getChildBlocks is unavailable in this host build.
    }

    const rows =
      (await this.postJson<Array<{ id?: string; content?: string }>>(
        "/api/query/sql",
        {
          stmt: `SELECT id, content FROM blocks WHERE root_id = '${validId}' AND type = 'h' ORDER BY sort ASC LIMIT 100`,
        },
        signal,
      )) ?? [];
    return rows
      .filter((row) => typeof row.id === "string" && tryParseNoteId(row.id))
      .map((row) => ({
        id: row.id as string,
        content: normalizeHeading(row.content),
      }))
      .filter((h) => Boolean(h.content));
  }

  async open(target: string, signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) return;
    const resolved = await this.resolve(target);
    if (signal?.aborted) return;
    await this.openBlock(resolved.id);
  }
}
