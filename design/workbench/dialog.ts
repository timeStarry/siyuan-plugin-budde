import { escape } from "./view";

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
    dialog.addEventListener("close", () => { const result = dialog.returnValue || cancel; dialog.remove(); resolve(result); }, { once: true });
    dialog.showModal();
    dialog.querySelector<HTMLButtonElement>(`button[value="${cancel}"]`)?.focus();
  });
}
