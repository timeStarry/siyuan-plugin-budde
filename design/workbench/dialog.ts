import { escape } from "./view";

/** Keep native top-layer content inside the plugin container, including embedded split panes. */
export function fitDialog(dialog: HTMLDialogElement): () => void {
  const host = dialog.closest<HTMLElement>(".workbench")!;
  const events = new AbortController();
  function place(): void {
    const box = host.getBoundingClientRect();
    Object.assign(dialog.style, { position: "fixed", margin: "0", left: `${box.left + box.width / 2}px`, top: `${box.top + box.height / 2}px`, transform: "translate(-50%, -50%)", maxWidth: `${Math.max(0, box.width - 32)}px`, maxHeight: `${Math.max(0, box.height - 32)}px` });
  }
  const observer = new ResizeObserver(place);
  observer.observe(host);
  window.addEventListener("resize", place, { signal: events.signal });
  window.addEventListener("scroll", place, { capture: true, signal: events.signal });
  place();
  return () => { observer.disconnect(); events.abort(); };
}

/** Shared guard, not a browser confirm: descriptive choices, Escape cancels, native focus trap. */
export function choose(title: string, message: string, choices: { value: string; label: string; primary?: boolean }[], cancel: string): Promise<string> {
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    const id = `guard-${crypto.randomUUID()}`;
    dialog.className = "guard-dialog";
    dialog.setAttribute("aria-labelledby", id);
    dialog.setAttribute("aria-describedby", `${id}-message`);
    dialog.innerHTML = `<form method="dialog"><h2 id="${id}">${escape(title)}</h2><p id="${id}-message">${escape(message)}</p><div class="guard-actions">${choices.map((choice) => `<button value="${escape(choice.value)}" class="${choice.primary ? "primary" : ""}">${escape(choice.label)}</button>`).join("")}</div></form>`;
    document.getElementById("modal-host")!.append(dialog);
    dialog.addEventListener("cancel", (event) => { event.preventDefault(); dialog.close(cancel); });
    const release = fitDialog(dialog);
    dialog.addEventListener("close", () => { const result = dialog.returnValue || cancel; release(); dialog.remove(); resolve(result); }, { once: true });
    dialog.showModal();
    dialog.querySelector<HTMLButtonElement>(`button[value="${cancel}"]`)?.focus();
  });
}
