import { useId, useState, type ReactNode } from "react";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { usePane } from "../../react-renderer";
import { Button } from "./button";
import { Icon } from "../icons";

export function DropdownMenu({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  const { root } = usePane(); const [open, setOpen] = useState(false); const owner = useId();
  return <Menu.Root modal={false} open={open} onOpenChange={setOpen}><Menu.Trigger asChild><Button variant="ghost" size="icon" data-menu-trigger data-menu-id={owner} className={className} aria-label={label}><Icon name="more" /></Button></Menu.Trigger><Menu.Portal container={root}><Menu.Content data-menu-owner={owner} align="end" sideOffset={4} collisionBoundary={root} onCloseAutoFocus={event => {
    // Never pull focus back from another instance/host after outside dismissal.
    const active = root.ownerDocument.activeElement;
    if (root.querySelector('dialog[open]') || (active && active !== root.ownerDocument.body && !root.contains(active))) event.preventDefault();
  }} className="bd-z-50 bd-min-w-40 bd-max-w-[min(24rem,var(--radix-dropdown-menu-content-available-width))] bd-max-h-[var(--radix-dropdown-menu-content-available-height)] bd-overflow-y-auto bd-overflow-x-hidden bd-rounded-md bd-border bd-border-border bd-bg-card bd-p-1 bd-text-foreground bd-shadow-xs">{children}</Menu.Content></Menu.Portal></Menu.Root>;
}
export function DropdownMenuItem({ children }: { children: ReactNode }) { return <Menu.Item asChild>{children}</Menu.Item>; }
export const menuItemClass = "bd-w-full bd-justify-start bd-font-normal focus:bd-bg-muted focus:bd-outline-none";
