import type { StageTemplateId, TypeColor } from "./type-config";

export interface Stage {
  id: string;
  name: string;
  completed: boolean;
}
export interface ItemType {
  id: string;
  name: string;
  initialStageId: string;
  stages: Stage[];
  icon?: string;
  color?: TypeColor;
}
export interface NoteLink {
  id: string;
  target: string;
  title: string;
  role: "reference" | "outcome";
}
export interface Item {
  id: string;
  title: string;
  typeId: string;
  stageId: string;
  description: string;
  nextStep: string;
  links: NoteLink[];
  promoted: boolean;
  paused: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
  version: number;
}
export interface BuddeState {
  schemaVersion: 1;
  revision: number;
  types: ItemType[];
  items: Item[];
  requests: Record<string, { fingerprint: string; itemId: string }>;
}
export interface StateStore {
  read(): Promise<BuddeState>;
  transaction<T>(mutate: (draft: BuddeState) => T): Promise<T>;
}
export type ItemPatch = Partial<
  Pick<
    Item,
    | "title"
    | "typeId"
    | "stageId"
    | "description"
    | "nextStep"
    | "links"
    | "promoted"
    | "paused"
    | "archived"
    | "reviewedAt"
  >
>;
export type Command =
  | { kind: "item.create"; requestId: string; title: string; typeId?: string }
  | {
      kind: "item.update";
      id: string;
      expectedVersion: number;
      patch: ItemPatch;
    }
  | { kind: "type.create"; expectedRevision: number; name: string; icon?: string | null; color?: TypeColor | null; template?: StageTemplateId }
  | {
      kind: "type.update";
      expectedRevision: number;
      id: string;
      name: string;
      initialStageId?: string;
      icon?: string | null;
      color?: TypeColor | null;
    }
  | { kind: "type.delete"; expectedRevision: number; id: string }
  | {
      kind: "stage.add";
      expectedRevision: number;
      typeId: string;
      name: string;
    }
  | {
      kind: "stage.update";
      expectedRevision: number;
      typeId: string;
      id: string;
      name: string;
      completed: boolean;
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
}
export interface BuddeClient {
  snapshot(): Promise<BuddeState>;
  execute(command: Command): Promise<CommandResult>;
  exportData(): Promise<string>;
}
export interface NoteBridge {
  resolve(target: string): Promise<{ target: string; title: string }>;
  open(target: string, signal?: AbortSignal): Promise<void>;
}
