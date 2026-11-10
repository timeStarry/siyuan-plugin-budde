import { Plugin, openTab, showMessage } from "siyuan";
import {
  BuddeService,
  createInitialState,
  validateState,
} from "./core/service";
import { NodeFileStore } from "./platform/node-file-store";
import { SiYuanNotes } from "./platform/siyuan-notes";
import { mountWorkbench } from "./ui";
import "./ui/styles.css";

type Workbench = ReturnType<typeof mountWorkbench>;
const TAB_TYPE = "workbench";

export default class BuddePlugin extends Plugin {
  private views = new Map<HTMLElement, Workbench>();
  private timer?: ReturnType<typeof setInterval>;
  private service?: BuddeService;
  private notes?: SiYuanNotes;
  private startupError?: string;

  onload(): void {
    this.addIcons(
      '<symbol id="iconBudde" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" d="M12 21V11M12 15C5 15 3 11 3 6c6 0 9 3 9 9Zm0-4c0-5 3-8 9-8 0 5-3 8-9 8Z"/></symbol>',
    );
    try {
      const host = window as unknown as {
        siyuan?: { config?: { system?: { dataDir?: string } } };
      };
      const dataDir = host.siyuan?.config?.system?.dataDir;
      if (!dataDir)
        throw new Error("未找到当前思源工作空间。Budde alpha 需要思源桌面端。");
      this.service = new BuddeService(
        new NodeFileStore(dataDir, createInitialState, validateState),
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
  }
  onLayoutReady(): void {
    this.addTopBar({
      icon: "iconBudde",
      title: "Budde · 想法池与看板",
      position: "right",
      callback: () => {
        void this.open();
      },
    });
    this.timer = setInterval(() => {
      if (document.visibilityState === "visible")
        for (const view of this.views.values())
          void view.refresh().catch(() => undefined);
    }, 3000);
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
    for (const view of this.views.values()) view.destroy();
    this.views.clear();
  }
}
