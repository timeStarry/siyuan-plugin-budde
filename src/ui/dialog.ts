import { createElement as h } from "react";
import { renderView, destroyView } from "./react-renderer";
import { GuardView } from "./guard-view";
import { dialogLayer, dialogSurface } from "./components/ui/dialog";
import { cn } from "./lib/utils";
export interface Choice { value: string; label: string; primary?: boolean }
/** Non-top-layer dialog: never inerts the SiYuan document or another tab. */
export function fitDialog(dialog: HTMLDialogElement): () => void {
  const root = dialog.closest<HTMLElement>(".budde")!;
  const layer = dialog.parentElement!;
  const opener = root.ownerDocument.activeElement as HTMLElement | null;
  const background = Array.from(root.children).filter((child): child is HTMLElement => child instanceof HTMLElement && child !== layer && !child.contains(dialog));
  const previous = background.map(child => child.inert);
  background.forEach(child => child.inert = true);
  const events = new AbortController();
  layer.addEventListener("keydown", event => {
    const guard = root.querySelector(".guard-dialog[open]");
    if (guard && guard !== dialog) return;
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); dialog.dispatchEvent(new Event("cancel", { cancelable: true })); }
    if (event.key !== "Tab") return;
    const nodes = Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,[tabindex="0"]')).filter(node => node.getClientRects().length && !node.closest("[inert]"));
    if (!nodes.length) { event.preventDefault(); dialog.focus(); return; }
    if (event.shiftKey && (root.ownerDocument.activeElement === nodes[0] || !dialog.contains(root.ownerDocument.activeElement))) { event.preventDefault(); nodes.at(-1)!.focus(); }
    else if (!event.shiftKey && (root.ownerDocument.activeElement === nodes.at(-1) || !dialog.contains(root.ownerDocument.activeElement))) { event.preventDefault(); nodes[0].focus(); }
  }, { signal: events.signal });
  dialog.setAttribute("aria-modal", "true");
  // show(), not showModal(): focus and inert are deliberately pane-local.
  dialog.show();
  let released = false;
  return () => {
    if (released) return; released = true; events.abort();
    background.forEach((child, i) => child.inert = previous[i]);
    dialog.removeAttribute("aria-modal");
    if (opener?.isConnected && root.contains(opener) && !opener.closest("[inert]")) opener.focus();
    // Closing a guard after a resize must restore current pane ownership, not
    // the pre-dialog desktop/overlay inert snapshot. Dispatch after close/remove.
    queueMicrotask(() => root.dispatchEvent(new Event("budde:dialog-close")));
  };
}
export function choose(root: HTMLElement, title: string, message: string, choices: Choice[], cancel = "cancel"): Promise<string> {
  return new Promise(resolve => {
    const layer = document.createElement("div"); layer.className = `dialog-layer guard-layer ${dialogLayer}`;
    const dialog = document.createElement("dialog"); dialog.className = cn("guard-dialog", dialogSurface, "bd-max-w-md"); dialog.tabIndex = -1;
    layer.append(dialog); root.append(layer);
    renderView(dialog, h(GuardView, { title, message, choices }));
    dialog.setAttribute("aria-describedby", dialog.querySelector("p")!.id);
    dialog.setAttribute("aria-labelledby", dialog.querySelector("h2")!.id);
    const release = fitDialog(dialog);
    let done = false;
    function finish(value: string) { if (done) return; done = true; release(); dialog.close(); destroyView(dialog); layer.remove(); resolve(value); }
    dialog.addEventListener("cancel", event => { event.preventDefault(); finish(cancel); });
    dialog.addEventListener("close", () => finish(cancel));
    dialog.addEventListener("click", event => { const button = (event.target as Element).closest<HTMLElement>("[data-choice]"); if (button) finish(button.dataset.choice!); });
    dialog.querySelector<HTMLElement>(`[data-choice="${CSS.escape(cancel)}"]`)?.focus();
  });
}
