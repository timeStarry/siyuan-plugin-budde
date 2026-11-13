import type { StageTemplateId, TypeColor } from "./type-config";

export type ItemStatus = "pool" | "active" | "paused" | "archived";
export type ItemPriority = "high" | "medium" | "low";

export interface StageCriterion {
  id: string;
  text: string;
}

export interface CustomCriterion {
  id: string;
  text: string;
  done: boolean;
}

export interface StageCriteriaProgress {
  checkedIds?: string[];
  custom?: CustomCriterion[];
}

export interface Stage {
  id: string;
  name: string;
  completed: boolean;
  criteria?: StageCriterion[];
}

export interface ItemType {
  id: string;
  name: string;
  initialStageId: string;
  stages: Stage[];
  icon?: string;
  color?: TypeColor;
  /** Days before an active, non-completed item prompts for review; null disables review reminder. */
  reviewDays?: number | null;
  /** Optional Markdown blueprint used when creating a linked SiYuan outcome document. */
  docTemplate?: string;
}

export interface TypePack {
  product: "BuddeTypePack";
  schemaVersion: 1;
  exportedAt: string;
  type: {
    name: string;
    icon?: string;
    color?: TypeColor;
    reviewDays?: number | null;
    docTemplate?: string;
    initialStageIndex: number;
    stages: Array<{
      name: string;
      completed: boolean;
      criteria?: string[];
    }>;
  };
}

export interface NoteLink {
  id: string;
  target: string;
  title: string;
  hpath?: string;
  role: "reference" | "outcome";
  /** Optional stage binding for section heading anchors or per-stage documents. */
  stageId?: string;
}

export interface Item {
  id: string;
  title: string;
  typeId: string;
  stageId: string;
  status: ItemStatus;
  priority?: ItemPriority;
  pinned: boolean;
  order: number;
  description: string;
  nextStep: string;
  links: NoteLink[];
  /** Per-stage checklist progress: checked preset criterion IDs + item-specific criteria. */
  criteriaState?: Record<string, StageCriteriaProgress>;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
  version: number;
}

export interface RequestRecord {
  fingerprint: string;
  itemId: string;
  createdAt: string;
}

export interface BuddeState {
  schemaVersion: 2;
  revision: number;
  defaultNotebookId?: string;
  types: ItemType[];
  items: Item[];
  requests: Record<string, RequestRecord>;
}

export interface StateStore {
  read(): Promise<BuddeState>;
  hasChangedSince?(mtimeMs: number): Promise<{ changed: boolean; mtimeMs: number }>;
  transaction<T>(mutate: (draft: BuddeState) => T, options?: { replaceWith?: BuddeState }): Promise<T>;
}

export type ItemPatch = Partial<
  Pick<
    Item,
    | "title"
    | "typeId"
    | "stageId"
    | "status"
    | "pinned"
    | "order"
    | "description"
    | "nextStep"
    | "links"
    | "reviewedAt"
  >
> & {
  priority?: ItemPriority | null;
  criteriaState?: Record<string, StageCriteriaProgress> | null;
};

export type Command =
  | {
      kind: "item.create";
      requestId: string;
      title: string;
      typeId?: string;
      status?: "pool" | "active";
      stageId?: string;
      priority?: ItemPriority;
      description?: string;
      nextStep?: string;
      links?: NoteLink[];
    }
  | {
      kind: "item.update";
      id: string;
      expectedVersion: number;
      patch: ItemPatch;
    }
  | {
      kind: "item.delete";
      id: string;
      expectedVersion?: number;
    }
  | {
      kind: "item.reorder";
      id: string;
      stageId?: string;
      beforeId?: string | null;
      afterId?: string | null;
    }
  | {
      kind: "items.archiveCompleted";
      expectedRevision: number;
      typeId?: string;
    }
  | {
      kind: "items.purgeArchived";
      expectedRevision: number;
      typeId?: string;
    }
  | {
      kind: "items.clearAll";
      expectedRevision: number;
    }
  | {
      kind: "state.resetDemo";
      expectedRevision: number;
    }
  | {
      kind: "item.syncNoteTitles";
      titles: Record<string, { title: string; hpath?: string }>;
    }
  | {
      kind: "preference.setNotebook";
      notebookId: string;
    }
  | {
      kind: "type.create";
      expectedRevision: number;
      name: string;
      icon?: string | null;
      color?: TypeColor | null;
      reviewDays?: number | null;
      docTemplate?: string | null;
      template?: StageTemplateId;
    }
  | {
      kind: "type.import";
      expectedRevision: number;
      pack: TypePack;
    }
  | {
      kind: "type.update";
      expectedRevision: number;
      id: string;
      name: string;
      initialStageId?: string;
      icon?: string | null;
      color?: TypeColor | null;
      reviewDays?: number | null;
      docTemplate?: string | null;
    }
  | {
      kind: "type.reorder";
      expectedRevision: number;
      ids: string[];
    }
  | {
      kind: "type.delete";
      expectedRevision: number;
      id: string;
      targetTypeId?: string;
    }
  | {
      kind: "stage.add";
      expectedRevision: number;
      typeId: string;
      name: string;
      completed?: boolean;
      criteria?: string[];
    }
  | {
      kind: "stage.update";
      expectedRevision: number;
      typeId: string;
      id: string;
      name: string;
      completed: boolean;
      criteria?: Array<{ id?: string; text: string }> | null;
    }
  | {
      kind: "stage.delete";
      expectedRevision: number;
      typeId: string;
      id: string;
      targetId?: string;
    }
  | {
      kind: "stage.reorder";
      expectedRevision: number;
      typeId: string;
      ids: string[];
    };

export interface CommandResult {
  state: BuddeState;
  itemId?: string;
  affectedCount?: number;
}

export interface BuddeClient {
  snapshot(): Promise<BuddeState>;
  hasChangedSince?(mtimeMs: number): Promise<{ changed: boolean; mtimeMs: number }>;
  execute(command: Command): Promise<CommandResult>;
  exportData(): Promise<string>;
  importData(raw: string): Promise<BuddeState>;
}

export interface NoteSummary {
  id: string;
  target: string;
  title: string;
  hpath?: string;
  isDoc: boolean;
}

export interface NotebookSummary {
  id: string;
  name: string;
}

export interface NoteBridge {
  resolve(target: string): Promise<{ id: string; target: string; title: string; hpath?: string }>;
  search(query: string, signal?: AbortSignal): Promise<NoteSummary[]>;
  listNotebooks(signal?: AbortSignal): Promise<NotebookSummary[]>;
  createDoc(
    options: { notebookId: string; title: string; markdown: string },
    signal?: AbortSignal,
  ): Promise<{ id: string; target: string; title: string; hpath?: string }>;
  resolveMany(
    targets: string[],
    signal?: AbortSignal,
  ): Promise<Record<string, { title: string; hpath?: string }>>;
  readDocMarkdown?(
    id: string,
    signal?: AbortSignal,
  ): Promise<{ id: string; title: string; markdown: string }>;
  getDocHeadings?(
    docId: string,
    signal?: AbortSignal,
  ): Promise<Array<{ id: string; content: string }>>;
  open(target: string, signal?: AbortSignal): Promise<void>;
}
