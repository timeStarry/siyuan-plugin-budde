import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { MotionConfig } from "framer-motion";
import type { BuddeClient, NoteBridge } from "../core/types";
import { PaneContext } from "./pane-context";
import { BuddeProvider } from "./context";
import { WorkbenchApp } from "./workbench-app";
import { QuickCaptureBox } from "./quick-capture";

export function mountWorkbench(
  root: HTMLElement,
  client: BuddeClient,
  notes: NoteBridge,
): { refresh(): Promise<void>; destroy(): void } {
  let destroyed = false;
  const instanceId = `budde-${crypto.randomUUID()}`;
  const refreshRef: { current: (() => Promise<void>) | null } = { current: null };

  root.classList.add("budde", "workbench");
  root.dataset.instance = instanceId;

  const reactRoot = createRoot(root, { identifierPrefix: `${instanceId}-` });
  flushSync(() => {
    reactRoot.render(
      createElement(
        PaneContext.Provider,
        { value: { root, instanceId } },
        createElement(
          MotionConfig,
          { reducedMotion: "user", transition: { duration: 0.18 } },
          createElement(BuddeProvider, {
            client,
            notes,
            refreshRef,
            children: createElement(WorkbenchApp),
          }),
        ),
      ),
    );
  });

  return {
    async refresh() {
      if (destroyed) return;
      await refreshRef.current?.();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      refreshRef.current = null;
      flushSync(() => {
        reactRoot.unmount();
      });
      root.replaceChildren();
      root.classList.remove("budde", "workbench");
      delete root.dataset.instance;
    },
  };
}

export function mountQuickCapture(
  root: HTMLElement,
  client: BuddeClient,
  callbacks: {
    onSuccess(title: string, active: boolean): void;
    onCancel(): void;
    onOpenWorkbench(): void;
  },
): { destroy(): void } {
  let destroyed = false;
  const instanceId = `budde-qc-${crypto.randomUUID()}`;
  root.classList.add("budde", "budde-quick-modal");
  root.dataset.instance = instanceId;

  const reactRoot = createRoot(root, { identifierPrefix: `${instanceId}-` });
  flushSync(() => {
    reactRoot.render(
      createElement(
        PaneContext.Provider,
        { value: { root, instanceId } },
        createElement(QuickCaptureBox, {
          client,
          onSuccess: callbacks.onSuccess,
          onCancel: callbacks.onCancel,
          onOpenWorkbench: callbacks.onOpenWorkbench,
        }),
      ),
    );
  });

  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      flushSync(() => {
        reactRoot.unmount();
      });
      root.replaceChildren();
      root.classList.remove("budde", "budde-quick-modal");
      delete root.dataset.instance;
    },
  };
}
