import type { ReactNode } from "react";
import * as Primitive from "@radix-ui/react-tooltip";
import { usePane } from "../../react-renderer";
export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  const { root } = usePane();
  return <Primitive.Provider delayDuration={500}><Primitive.Root><Primitive.Trigger asChild>{children}</Primitive.Trigger><Primitive.Portal container={root}><Primitive.Content sideOffset={6} className="bd-z-50 bd-max-w-64 bd-break-words bd-rounded-md bd-border bd-border-border bd-bg-card bd-px-3 bd-py-2 bd-text-xs bd-text-foreground bd-shadow-xs">{label}</Primitive.Content></Primitive.Portal></Primitive.Root></Primitive.Provider>;
}
