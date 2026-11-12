import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "bd-inline-flex bd-max-w-full bd-items-center bd-gap-1 bd-rounded-sm bd-border bd-px-1.5 bd-py-0.5 bd-text-xs bd-font-normal bd-leading-4 bd-tabular-nums",
  {
    variants: {
      variant: {
        default: "bd-border-border bd-bg-muted bd-text-muted-foreground",
        outline: "bd-border-border bd-bg-card bd-text-foreground",
        warning: "bd-border-warning/30 bd-bg-warning/10 bd-text-warning",
        success: "bd-border-success/30 bd-bg-success/10 bd-text-success",
        destructive: "bd-border-destructive/30 bd-bg-destructive/10 bd-text-destructive",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
