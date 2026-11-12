import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePane } from "../../pane-context";
import { cn } from "../../lib/utils";

/**
 * Instance-scoped modal inside `.budde`.
 * Never uses document.body or native showModal(), so SiYuan editor tabs and other Budde panes stay interactive.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  maxWidthClass = "bd-max-w-lg",
  zIndexClass = "bd-z-40",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  maxWidthClass?: string;
  zIndexClass?: string;
  children: ReactNode;
}) {
  const { root } = usePane();
  const layerRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const composingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    if (!open) return;
    const layer = layerRef.current;
    const dialog = dialogRef.current;
    if (!layer || !dialog) return;

    const doc = root.ownerDocument;
    const opener = doc.activeElement as HTMLElement | null;
    const siblings = Array.from(root.children).filter(
      (child): child is HTMLElement => child instanceof HTMLElement && child !== layer,
    );
    const prevInert = siblings.map((el) => el.inert);
    siblings.forEach((el) => {
      el.inert = true;
    });

    const firstFocusable = dialog.querySelector<HTMLElement>(
      'input:not(:disabled),textarea:not(:disabled),select:not(:disabled),button[data-autofocus]:not(:disabled),button:not(:disabled),[tabindex="0"]',
    );
    (firstFocusable ?? dialog).focus({ preventScroll: true });

    const onKeyDown = (event: KeyboardEvent) => {
      if (composingRef.current || event.isComposing || event.keyCode === 229) return;
      // Only handle if this modal is the topmost modal in root
      const modals = Array.from(root.querySelectorAll<HTMLElement>("[data-budde-modal-layer]"));
      if (modals.at(-1) !== layer) return;

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key === "Tab") {
        const nodes = Array.from(
          dialog.querySelectorAll<HTMLElement>(
            'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
          ),
        ).filter((node) => node.getClientRects().length > 0 && !node.closest("[inert]"));
        if (nodes.length === 0) {
          event.preventDefault();
          dialog.focus();
          return;
        }
        const active = doc.activeElement;
        if (event.shiftKey && (active === nodes[0] || !dialog.contains(active))) {
          event.preventDefault();
          nodes.at(-1)!.focus();
        } else if (!event.shiftKey && (active === nodes.at(-1) || !dialog.contains(active))) {
          event.preventDefault();
          nodes[0]!.focus();
        }
      }
    };

    layer.addEventListener("keydown", onKeyDown);
    return () => {
      layer.removeEventListener("keydown", onKeyDown);
      siblings.forEach((el, idx) => {
        el.inert = prevInert[idx];
      });
      if (opener?.isConnected && root.contains(opener) && !opener.closest("[inert]")) {
        opener.focus({ preventScroll: true });
      }
    };
  }, [open, root]);

  if (!open) return null;

  return createPortal(
    <div
      ref={layerRef}
      data-budde-modal-layer=""
      onCompositionStart={() => {
        composingRef.current = true;
      }}
      onCompositionEnd={() => {
        composingRef.current = false;
      }}
      onMouseDown={(event) => {
        if (event.target === layerRef.current) {
          onClose();
        }
      }}
      className={cn(
        "bd-absolute bd-inset-0 bd-flex bd-items-center bd-justify-center bd-bg-scrim/20 bd-p-4 bd-backdrop-blur-[2px]",
        zIndexClass,
      )}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        data-budde-modal="true"
        tabIndex={-1}
        className={cn(
          "bd-relative bd-flex bd-max-h-full bd-w-full bd-flex-col bd-overflow-hidden bd-rounded-lg bd-border bd-border-border bd-bg-card bd-text-foreground bd-shadow-lift focus:bd-outline-none",
          maxWidthClass,
        )}
      >
        <h2 id={titleId} className="bd-sr-only">
          {title}
        </h2>
        {description && (
          <p id={descId} className="bd-sr-only">
            {description}
          </p>
        )}
        {children}
      </div>
    </div>,
    root,
  );
}
