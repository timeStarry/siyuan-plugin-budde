import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

export const buttonVariants = cva(
  "bd-inline-flex bd-shrink-0 bd-items-center bd-justify-center bd-gap-2 bd-whitespace-nowrap bd-rounded-md bd-border bd-font-medium bd-transition-colors focus-visible:bd-outline-none focus-visible:bd-ring-2 focus-visible:bd-ring-ring focus-visible:bd-ring-offset-1 disabled:bd-cursor-not-allowed disabled:bd-opacity-50 motion-reduce:bd-transition-none",
  {
    variants: {
      variant: {
        default:
          "bd-border-transparent bd-bg-primary bd-text-primary-foreground hover:bd-bg-primary-hover",
        outline:
          "bd-border-border bd-bg-card bd-text-foreground hover:bd-bg-muted",
        ghost:
          "bd-border-transparent bd-bg-transparent bd-text-muted-foreground hover:bd-bg-muted hover:bd-text-foreground aria-pressed:bd-bg-accent aria-pressed:bd-text-foreground",
        destructive:
          "bd-border-destructive/30 bd-bg-destructive/10 bd-text-destructive hover:bd-bg-destructive hover:bd-text-destructive-foreground",
      },
      size: {
        default: "bd-h-9 bd-min-h-9 bd-px-3 bd-py-2 bd-text-control",
        sm: "bd-h-8 bd-min-h-8 bd-px-2.5 bd-py-1 bd-text-xs",
        icon: "bd-h-9 bd-w-9 bd-min-h-9 bd-min-w-9 bd-p-0 bd-text-control",
        iconSm: "bd-h-7 bd-w-7 bd-min-h-7 bd-min-w-7 bd-p-0 bd-text-xs",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type = "button", ...props }, ref) => {
    const Component = asChild ? Slot : "button";
    return (
      <Component
        ref={ref}
        type={asChild ? undefined : type}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
