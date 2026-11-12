import * as React from "react";
import { cn } from "../../lib/utils";

const field = "bd-box-border bd-flex bd-w-full bd-min-w-0 bd-rounded-md bd-border bd-border-input bd-bg-card bd-px-3 bd-text-control bd-text-foreground bd-transition-colors placeholder:bd-text-muted-foreground focus-visible:bd-outline-none focus-visible:bd-ring-2 focus-visible:bd-ring-ring disabled:bd-cursor-not-allowed disabled:bd-bg-muted disabled:bd-opacity-60 aria-invalid:bd-ring-1 aria-invalid:bd-ring-ring";
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, type = "text", style, ...props }, ref) => <input ref={ref} type={type} style={{ boxSizing: "border-box", ...style }} className={cn(field, "bd-h-9 bd-py-0", className)} {...props} />);
Input.displayName = "Input";
export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, style, ...props }, ref) => <textarea ref={ref} style={{ boxSizing: "border-box", ...style }} className={cn(field, "bd-min-h-24 bd-resize-y bd-py-2 bd-leading-6", className)} {...props} />);
Textarea.displayName = "Textarea";
/** shadcn Native Select adaptation: native keyboard semantics and existing change
 * delegation remain intact. It never portals into the host document. */
export const NativeSelect = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, style, ...props }, ref) => <select ref={ref} style={{ boxSizing: "border-box", ...style }} className={cn(field, "bd-h-9 bd-appearance-none bd-py-0 bd-pr-7", className)} {...props} />);
NativeSelect.displayName = "NativeSelect";
export const Select = NativeSelect;
export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) { return <label className={cn("bd-block bd-text-control bd-font-medium bd-text-foreground", className)} {...props} />; }
export function FieldHelp({ children }: { children: React.ReactNode }) { return <p className="bd-text-xs bd-leading-5 bd-text-muted-foreground">{children}</p>; }
