import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

export const buttonVariants = cva("bd-inline-flex bd-h-9 bd-min-h-9 bd-shrink-0 bd-items-center bd-justify-center bd-gap-2 bd-whitespace-nowrap bd-rounded-md bd-border bd-text-control bd-font-medium bd-transition-colors focus-visible:bd-outline-none focus-visible:bd-ring-2 focus-visible:bd-ring-ring focus-visible:bd-ring-offset-2 disabled:bd-cursor-not-allowed disabled:bd-opacity-50 motion-reduce:bd-transition-none", {
  variants: {
    variant: {
      default: "bd-border-transparent bd-bg-primary bd-text-primary-foreground hover:bd-bg-primary-hover",
      outline: "bd-border-border bd-bg-card bd-text-foreground hover:bd-bg-muted",
      ghost: "bd-border-transparent bd-bg-transparent bd-text-muted-foreground hover:bd-bg-muted hover:bd-text-foreground aria-pressed:bd-bg-accent aria-pressed:bd-text-foreground",
    },
    size: { default: "bd-px-3 bd-py-2", icon: "bd-w-9 bd-min-w-9 bd-p-0" },
  }, defaultVariants: { variant: "default", size: "default" },
});
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> { asChild?: boolean }
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, type = "button", ...props }, ref) => {
  const Component = asChild ? Slot : "button";
  return <Component ref={ref} type={asChild ? undefined : type} className={cn(buttonVariants({ variant, size, className }))} {...props} />;
});
Button.displayName = "Button";
