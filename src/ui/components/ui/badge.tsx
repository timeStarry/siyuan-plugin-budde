import type { HTMLAttributes } from "react";
import { cva } from "class-variance-authority";
import { cn } from "../../lib/utils";
const variants = cva("bd-inline-flex bd-max-w-full bd-items-center bd-gap-1 bd-rounded-sm bd-border bd-border-border bd-bg-muted bd-px-1.5 bd-py-0.5 bd-text-xs bd-font-normal bd-leading-4 bd-text-muted-foreground bd-tabular-nums");
export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) { return <span className={cn(variants(), className)} {...props} />; }
