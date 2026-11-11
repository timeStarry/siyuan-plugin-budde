export function query<T extends HTMLElement = HTMLElement>(root: HTMLElement, selector: string): T {
  return root.querySelector<T>(selector.replace(/#([\w-]+)/g, '[data-part="$1"]'))!;
}
/** Lucide semantic names are local decoration, never persisted schema fields. */
export type IconName = "brand" | "pool" | "board" | "active" | "archive" | "more" | "plus" | "up" | "down" | "note" | "code" | "plane" | "shapes" | "settings" | "search" | "circle" | "target" | "build" | "check" | "pause" | "clock" | "link" | "edit" | "close" | "arrow" | "open" | "grip";
export function typeIcon(name: string): IconName {
  switch (name) { case "软件": return "code"; case "文章": return "note"; case "旅行": return "plane"; default: return "shapes"; }
}
