import { Dialog, Plugin, openTab, showMessage } from "siyuan";
import { BUDDE_ICON_SYMBOL } from "./brand";
import {
  BuddeService,
  createInitialState,
  validateState,
} from "./core/service";
import { NodeFileStore } from "./platform/node-file-store";
import { SiYuanNotes, tryParseNoteId } from "./platform/siyuan-notes";
import { mountQuickCapture, mountWorkbench } from "./ui";
import "./ui/styles.css";

type Workbench = ReturnType<typeof mountWorkbench>;
const TAB_TYPE = "workbench";

export default class BuddePlugin extends Plugin {
  private views = new Map<HTMLElement, Workbench>();
  private quickCaptureDialog?: { destroy(): void };
  private timer?: ReturnType<typeof setInterval>;
  private service?: BuddeService;
  private notes?: SiYuanNotes;
  private startupError?: string;

  private readonly onBlockIcon = (event: CustomEvent<{
    menu: { addItem(option: { icon: string; label: string; click: () => void }): void };
    blockElements: HTMLElement[];
  }>) => {
    const el = event.detail?.blockElements?.[0];
    if (!el || !this.service) return;
    const rawId = el.getAttribute("data-node-id") ?? "";
    const validId = tryParseNoteId(rawId);
    const rawText = (el.textContent ?? "").replace(/\s+/g, " ").trim();
    if (!validId && !rawText) return;

    event.detail.menu.addItem({
      icon: "iconBudde",
      label: this.i18n?.captureBlockToBudde ?? "收入 Budde 想法池",
      click: () => {
        void this.captureFromEditor({
          title: (rawText || validId || "来自思源笔记的想法").slice(0, 200),
          blockId: validId ?? undefined,
        });
      },
    });
  };

  private readonly onDocTitleIcon = (event: CustomEvent<{
    menu: { addItem(option: { icon: string; label: string; click: () => void }): void };
    data: { id?: string; name?: string; rootID?: string };
  }>) => {
    const docId = tryParseNoteId(event.detail?.data?.id ?? event.detail?.data?.rootID ?? "");
    const docTitle = (event.detail?.data?.name ?? "").trim();
    if (!docId || !this.service) return;

    event.detail.menu.addItem({
      icon: "iconBudde",
      label: this.i18n?.captureDocToBudde ?? "将本文档收入 Budde 想法池",
      click: () => {
        void this.captureFromEditor({
          title: (docTitle || docId).slice(0, 200),
          blockId: docId,
        });
      },
    });
  };

  onload(): void {
    if (typeof document !== "undefined") {
      document
        .querySelectorAll?.('svg[data-name="siyuan-plugin-budde"] symbol#iconBudde')
        .forEach((node) => node.remove());
    }
    this.addIcons(BUDDE_ICON_SYMBOL);
    try {
      const host = window as unknown as {
        siyuan?: { config?: { system?: { dataDir?: string } } };
      };
      const dataDir = host.siyuan?.config?.system?.dataDir;
      if (!dataDir) {
        throw new Error("未找到当前思源工作空间。Budde 需要思源桌面端。");
      }
      this.service = new BuddeService(
        new NodeFileStore(
          dataDir,
          () => createInitialState({ withSamples: true }),
          validateState,
        ),
      );
      this.notes = new SiYuanNotes(async (id) => {
        await openTab({ app: this.app, doc: { id } });
      });
    } catch (error) {
      this.startupError =
        error instanceof Error ? error.message : String(error);
    }

    const plugin = this;
    this.addTab({
      type: TAB_TYPE,
      init() {
        plugin.mount(this.element as HTMLElement);
      },
      destroy() {
        plugin.views.get(this.element as HTMLElement)?.destroy();
        plugin.views.delete(this.element as HTMLElement);
      },
    });

    this.addCommand({
      langKey: "openBudde",
      hotkey: "⌥⇧B",
      callback: () => {
        void this.open();
      },
    });

    this.addCommand({
      langKey: "quickCaptureBudde",
      hotkey: "⌥⇧N",
      callback: () => {
        this.openQuickCapture();
      },
    });

    this.eventBus?.on("click-blockicon", this.onBlockIcon as never);
    this.eventBus?.on("click-editortitleicon", this.onDocTitleIcon as never);
  }

  onLayoutReady(): void {
    this.addTopBar({
      icon: "iconBudde",
      title: "Budde · 想法池与看板（按住 Shift 点击快速记录）",
      position: "right",
      callback: (event?: MouseEvent) => {
        if (event?.shiftKey) {
          this.openQuickCapture();
        } else {
          void this.open();
        }
      },
    });

    this.timer = setInterval(() => {
      if (document.visibilityState === "visible" && this.views.size > 0) {
        for (const view of this.views.values()) {
          void view.refresh().catch(() => undefined);
        }
      }
    }, 3000);
  }

  private async captureFromEditor(payload: { title: string; blockId?: string }): Promise<void> {
    if (!this.service) return;
    try {
      await this.service.execute({
        kind: "item.create",
        requestId: crypto.randomUUID(),
        title: payload.title,
        status: "pool",
        links: payload.blockId
          ? [
              {
                id: crypto.randomUUID(),
                target: `siyuan://blocks/${payload.blockId}`,
                title: payload.title.slice(0, 160),
                role: "reference",
              },
            ]
          : [],
      });
      for (const view of this.views.values()) {
        void view.refresh().catch(() => undefined);
      }
      showMessage(`已收入 Budde 想法池：${payload.title.slice(0, 40)}`, 3000, "info");
    } catch (error) {
      showMessage(
        error instanceof Error ? error.message : "收入 Budde 失败。",
        5000,
        "error",
      );
    }
  }

  private openQuickCapture(): void {
    if (!this.service) {
      showMessage(this.startupError ?? "Budde 初始化失败。", 5000, "error");
      return;
    }
    if (typeof Dialog !== "function") {
      void this.open();
      return;
    }
    this.quickCaptureDialog?.destroy();
    let mounted: { destroy(): void } | undefined;
    const dialog = new Dialog({
      width: "520px",
      hideCloseIcon: true,
      content: '<div class="budde-quick-capture-host"></div>',
      destroyCallback: () => {
        mounted?.destroy();
        if (this.quickCaptureDialog === dialog) {
          this.quickCaptureDialog = undefined;
        }
      },
    });
    this.quickCaptureDialog = dialog;
    const containerEl = dialog.element.querySelector<HTMLElement>(".b3-dialog__container");
    if (containerEl) {
      containerEl.style.background = "transparent";
      containerEl.style.border = "none";
      containerEl.style.boxShadow = "none";
    }
    const bodyEl = dialog.element.querySelector<HTMLElement>(".b3-dialog__body");
    if (bodyEl) {
      bodyEl.style.overflow = "visible";
    }
    const hostEl = dialog.element.querySelector<HTMLElement>(".budde-quick-capture-host");
    if (!hostEl) return;

    mounted = mountQuickCapture(hostEl, this.service, {
      onSuccess: (title, active) => {
        dialog.destroy();
        for (const view of this.views.values()) {
          void view.refresh().catch(() => undefined);
        }
        showMessage(
          active ? `已记录并开始推进：${title}` : `已记入 Budde 想法池：${title}`,
          2600,
          "info",
        );
      },
      onCancel: () => {
        dialog.destroy();
      },
      onOpenWorkbench: () => {
        dialog.destroy();
        void this.open();
      },
    });
  }

  private mount(element: HTMLElement): void {
    this.views.get(element)?.destroy();
    if (!this.service || !this.notes) {
      const error = document.createElement("p");
      error.textContent = this.startupError ?? "Budde 初始化失败。";
      error.setAttribute("role", "alert");
      element.replaceChildren(error);
      return;
    }
    this.views.set(element, mountWorkbench(element, this.service, this.notes));
  }

  private async open(): Promise<void> {
    try {
      await openTab({
        app: this.app,
        custom: { id: this.name + TAB_TYPE, icon: "iconBudde", title: "Budde" },
      });
    } catch (error) {
      showMessage(
        error instanceof Error ? error.message : "Budde 打开失败。",
        6000,
        "error",
      );
    }
  }

  onunload(): void {
    if (this.timer) clearInterval(this.timer);
    this.eventBus?.off("click-blockicon", this.onBlockIcon as never);
    this.eventBus?.off("click-editortitleicon", this.onDocTitleIcon as never);
    this.quickCaptureDialog?.destroy();
    this.quickCaptureDialog = undefined;
    for (const view of this.views.values()) view.destroy();
    this.views.clear();
  }
}
