import * as React from "react";
import { cn } from "../../lib/utils";
/** Host-safe shadcn Dialog surface. Uses show(), not a global modal/portal.
 * The existing fitDialog controller owns instance-local inert and focus trapping;
 * a default Radix modal would aria-hide/scroll-lock unrelated SiYuan tabs. */
export const dialogSurface = "bd-relative bd-m-auto bd-max-h-full bd-w-full bd-max-w-[760px] bd-overflow-auto bd-rounded-lg bd-border bd-border-border bd-bg-card bd-p-6 bd-text-foreground bd-shadow-xs";
export const Dialog = React.forwardRef<HTMLDialogElement, React.DialogHTMLAttributes<HTMLDialogElement>>(({ className, ...props }, ref) => <dialog ref={ref} className={cn(dialogSurface, className)} {...props} />);
Dialog.displayName = "Dialog";
export const dialogLayer = "bd-absolute bd-inset-0 bd-z-30 bd-flex bd-items-center bd-justify-center bd-bg-scrim/10 bd-p-4";
export function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) { return <h2 className={cn("bd-text-xl bd-font-semibold bd-leading-7", className)} {...props} />; }
export function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) { return <p className={cn("bd-text-sm bd-leading-6 bd-text-muted-foreground", className)} {...props} />; }
