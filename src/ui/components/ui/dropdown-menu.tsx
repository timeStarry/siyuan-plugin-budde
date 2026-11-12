import { useId, useState, type ReactNode } from "react";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { usePane } from "../../pane-context";
import { Button } from "./button";
import { Icon } from "../icons";

export function DropdownMenu({
  label,
  trigger,
  children,
  className = "",
  align = "end",
}: {
  label: string;
  trigger?: ReactNode;
  children: ReactNode;
  className?: string;
  align?: "start" | "center" | "end";
}) {
  const { root } = usePane();
  const [open, setOpen] = useState(false);
  const owner = useId();
  return (
    <Menu.Root modal={false} open={open} onOpenChange={setOpen}>
      <Menu.Trigger asChild>
        {trigger ?? (
          <Button
            variant="ghost"
            size="icon"
            data-menu-trigger
            data-menu-id={owner}
            className={className}
            aria-label={label}
          >
            <Icon name="more" />
          </Button>
        )}
      </Menu.Trigger>
      <Menu.Portal container={root}>
        <Menu.Content
          data-menu-owner={owner}
          align={align}
          sideOffset={4}
          collisionBoundary={root}
          onCloseAutoFocus={(event) => {
            const active = root.ownerDocument.activeElement;
            if (
              root.querySelector('[data-budde-modal="true"]') ||
              (active && active !== root.ownerDocument.body && !root.contains(active))
            ) {
              event.preventDefault();
            }
          }}
          className="bd-z-50 bd-min-w-44 bd-max-w-[min(22rem,var(--radix-dropdown-menu-content-available-width))] bd-max-h-[var(--radix-dropdown-menu-content-available-height)] bd-overflow-y-auto bd-overflow-x-hidden bd-rounded-md bd-border bd-border-border bd-bg-card/95 bd-p-1 bd-text-foreground bd-shadow-sm bd-backdrop-blur-[12px]"
        >
          {children}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}

export function DropdownMenuItem({
  onSelect,
  disabled,
  destructive = false,
  children,
}: {
  onSelect?: () => void;
  disabled?: boolean;
  destructive?: boolean;
  children: ReactNode;
}) {
  return (
    <Menu.Item
      disabled={disabled}
      onSelect={() => onSelect?.()}
      className={`bd-flex bd-h-8 bd-w-full bd-cursor-pointer bd-select-none bd-items-center bd-gap-2 bd-rounded-sm bd-px-2.5 bd-text-control bd-outline-none focus:bd-bg-muted data-[disabled]:bd-pointer-events-none data-[disabled]:bd-opacity-45 ${
        destructive ? "bd-text-destructive focus:bd-bg-destructive/10" : "bd-text-foreground"
      }`}
    >
      {children}
    </Menu.Item>
  );
}

export function DropdownMenuSeparator() {
  return <Menu.Separator className="bd-my-1 bd-h-px bd-bg-border" />;
}
