import { createContext, useContext } from "react";

export interface PaneInfo {
  root: HTMLElement;
  instanceId: string;
}

export const PaneContext = createContext<PaneInfo | null>(null);

export function usePane(): PaneInfo {
  const ctx = useContext(PaneContext);
  if (!ctx) throw new Error("Missing Budde PaneContext");
  return ctx;
}
