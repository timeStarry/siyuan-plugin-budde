import { createContext, useContext, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { flushSync } from "react-dom";
import { MotionConfig } from "framer-motion";

interface Pane { root: HTMLElement; prefix: string }
const PaneContext = createContext<Pane | null>(null);
const roots = new Map<HTMLElement, { react: Root; pane: Pane }>();
export function usePane() { const pane = useContext(PaneContext); if (!pane) throw Error("Missing Budde pane"); return pane; }
export function usePart() { const { prefix } = usePane(); return (name: string) => ({ id: `${prefix}-${name}`, "data-part": name }); }
/** Existing controllers keep command/async ownership; every production view is React.
 * Dispose nested view roots before parent reconciliation can remove their hosts. */
export function renderView(container: HTMLElement, content: ReactNode) {
  destroyDescendants(container);
  let record = roots.get(container);
  if (!record) {
    const root = container.closest<HTMLElement>(".budde")!;
    const pane = { root, prefix: root.dataset.instance! };
    record = { react: createRoot(container, { identifierPrefix: `${pane.prefix}-${crypto.randomUUID()}-` }), pane };
    roots.set(container, record);
  }
  const { react, pane } = record;
  flushSync(() => react.render(<PaneContext.Provider value={pane}><MotionConfig reducedMotion="user" transition={{ duration: 0.2 }}>{content}</MotionConfig></PaneContext.Provider>));
}
function destroyDescendants(container: HTMLElement) {
  const nested = [...roots.keys()].filter(node => node !== container && container.contains(node));
  // Descendant roots must unmount before their parent can remove their DOM.
  nested.sort((a, b) => a.contains(b) ? 1 : b.contains(a) ? -1 : 0);
  for (const node of nested) destroyView(node);
}
export function destroyView(container: HTMLElement) { destroyDescendants(container); const record = roots.get(container); if (!record) return; roots.delete(container); flushSync(() => record.react.unmount()); }
export function destroyViews(root: HTMLElement) { for (const [container, record] of [...roots]) if (record.pane.root === root) destroyView(container); }
