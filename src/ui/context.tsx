import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { BuddeClient, BuddeState, Command, CommandResult, NoteBridge } from "../core/types";
import { Modal } from "./components/ui/modal";
import { Button } from "./components/ui/button";
import { Icon } from "./components/icons";

export interface ToastItem {
  id: string;
  message: string;
  tone: "info" | "success" | "error";
}

export interface ConfirmOptions {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

export interface BuddeContextValue {
  state: BuddeState | null;
  loading: boolean;
  fatalError: string | null;
  client: BuddeClient;
  notes: NoteBridge;
  toast(message: string, tone?: ToastItem["tone"]): void;
  confirm(options: ConfirmOptions): Promise<boolean>;
  execute(
    command: Command,
    options?: { successMessage?: string; silentError?: boolean },
  ): Promise<{ ok: true; result: CommandResult } | { ok: false; error: unknown; message: string }>;
  refresh(force?: boolean): Promise<void>;
  importJson(raw: string): Promise<boolean>;
  exportJson(): Promise<void>;
}

const BuddeContext = createContext<BuddeContextValue | null>(null);

export function useBudde(): BuddeContextValue {
  const ctx = useContext(BuddeContext);
  if (!ctx) throw new Error("Missing BuddeProvider");
  return ctx;
}

export function BuddeProvider({
  client,
  notes,
  refreshRef,
  children,
}: {
  client: BuddeClient;
  notes: NoteBridge;
  refreshRef?: { current: (() => Promise<void>) | null };
  children: ReactNode;
}) {
  const [state, setState] = useState<BuddeState | null>(null);
  const [loading, setLoading] = useState(true);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmRequest, setConfirmRequest] = useState<{
    options: ConfirmOptions;
    resolve: (ok: boolean) => void;
  } | null>(null);

  const mountedRef = useRef(true);
  const stateRef = useRef<BuddeState | null>(null);
  const lastMtimeRef = useRef<number>(-1);
  const refreshingRef = useRef(false);
  const syncedRevisionRef = useRef<number>(-1);
  const toastTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      for (const timer of toastTimersRef.current.values()) clearTimeout(timer);
      toastTimersRef.current.clear();
    };
  }, []);

  const adopt = useCallback((next: BuddeState) => {
    if (!mountedRef.current) return;
    if (stateRef.current && next.revision < stateRef.current.revision) return;
    stateRef.current = next;
    setState(next);
    setFatalError(null);
  }, []);

  const dismissToast = useCallback((id: string) => {
    const timer = toastTimersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      toastTimersRef.current.delete(id);
    }
    if (mountedRef.current) {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }
  }, []);

  const toast = useCallback(
    (message: string, tone: ToastItem["tone"] = "info") => {
      if (!mountedRef.current || !message) return;
      const id = crypto.randomUUID();
      setToasts((prev) => {
        const kept = prev.filter((item) => {
          const keep = tone === "error" || item.tone === "error";
          if (!keep) {
            const oldTimer = toastTimersRef.current.get(item.id);
            if (oldTimer) {
              clearTimeout(oldTimer);
              toastTimersRef.current.delete(item.id);
            }
          }
          return keep;
        });
        return [...kept.slice(-1), { id, message, tone }];
      });
      const duration = tone === "error" ? 4500 : 2200;
      const timer = setTimeout(() => dismissToast(id), duration);
      toastTimersRef.current.set(id, timer);
    },
    [dismissToast],
  );

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      if (!mountedRef.current) {
        resolve(false);
        return;
      }
      setConfirmRequest({ options, resolve });
    });
  }, []);

  const syncLinkedNoteTitles = useCallback(
    async (snapshot: BuddeState) => {
      if (syncedRevisionRef.current === snapshot.revision) return;
      syncedRevisionRef.current = snapshot.revision;
      const targets = snapshot.items.flatMap((item) => item.links.map((link) => link.target));
      if (targets.length === 0) return;
      try {
        const resolved = await notes.resolveMany(targets);
        if (!mountedRef.current || Object.keys(resolved).length === 0) return;
        const needsUpdate = snapshot.items.some((item) =>
          item.links.some((link) => {
            const rawId = link.target.replace("siyuan://blocks/", "");
            const fresh = resolved[rawId] ?? resolved[link.target];
            return Boolean(fresh && fresh.title && (fresh.title !== link.title || fresh.hpath !== link.hpath));
          }),
        );
        if (!needsUpdate) return;
        const res = await client.execute({ kind: "item.syncNoteTitles", titles: resolved });
        adopt(res.state);
      } catch {
        // Silent background enrichment: never interrupt the user if SiYuan SQL isn't reachable in synthetic/offline context.
      }
    },
    [adopt, client, notes],
  );

  const refresh = useCallback(
    async (force = false) => {
      if (!mountedRef.current || refreshingRef.current) return;
      refreshingRef.current = true;
      try {
        if (!force && stateRef.current && client.hasChangedSince) {
          const check = await client.hasChangedSince(lastMtimeRef.current);
          if (!check.changed) return;
          lastMtimeRef.current = check.mtimeMs;
        }
        const next = await client.snapshot();
        if (!mountedRef.current) return;
        if (client.hasChangedSince) {
          const check = await client.hasChangedSince(lastMtimeRef.current);
          lastMtimeRef.current = check.mtimeMs;
        }
        if (!stateRef.current || next.revision >= stateRef.current.revision) {
          adopt(next);
          void syncLinkedNoteTitles(next);
        }
      } catch (cause) {
        if (!mountedRef.current) return;
        const msg = cause instanceof Error ? cause.message : String(cause);
        if (!stateRef.current) setFatalError(msg);
        else toast(msg, "error");
      } finally {
        refreshingRef.current = false;
        if (mountedRef.current) setLoading(false);
      }
    },
    [adopt, client, syncLinkedNoteTitles, toast],
  );

  useEffect(() => {
    if (refreshRef) {
      refreshRef.current = () => refresh(false);
    }
    void refresh(true);
    return () => {
      if (refreshRef) refreshRef.current = null;
    };
  }, [refresh, refreshRef]);

  const execute = useCallback<BuddeContextValue["execute"]>(
    async (command, options) => {
      try {
        const result = await client.execute(command);
        adopt(result.state);
        if (client.hasChangedSince) {
          const check = await client.hasChangedSince(lastMtimeRef.current);
          lastMtimeRef.current = check.mtimeMs;
        }
        if (options?.successMessage) {
          toast(options.successMessage, "success");
        }
        return { ok: true, result };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!options?.silentError) {
          toast(message, "error");
        }
        return { ok: false, error, message };
      }
    },
    [adopt, client, toast],
  );

  const exportJson = useCallback(async () => {
    try {
      const data = await client.exportData();
      if (!mountedRef.current) return;
      const dateSuffix = new Date().toISOString().slice(0, 10);
      const url = URL.createObjectURL(new Blob([data], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `budde-backup-${dateSuffix}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 100);
      toast("已导出 JSON 备份（不含思源笔记正文）", "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : String(error), "error");
    }
  }, [client, toast]);

  const importJson = useCallback(
    async (raw: string): Promise<boolean> => {
      try {
        const imported = await client.importData(raw);
        adopt(imported);
        toast(`导入成功，共载入 ${imported.items.length} 个事项`, "success");
        void syncLinkedNoteTitles(imported);
        return true;
      } catch (error) {
        toast(error instanceof Error ? error.message : String(error), "error");
        return false;
      }
    },
    [adopt, client, syncLinkedNoteTitles, toast],
  );

  const value = useMemo<BuddeContextValue>(
    () => ({
      state,
      loading,
      fatalError,
      client,
      notes,
      toast,
      confirm,
      execute,
      refresh,
      importJson,
      exportJson,
    }),
    [state, loading, fatalError, client, notes, toast, confirm, execute, refresh, importJson, exportJson],
  );

  return (
    <BuddeContext.Provider value={value}>
      {children}

      {toasts.length > 0 && (
        <div
          aria-live="polite"
          aria-atomic="false"
          className="bd-pointer-events-none bd-absolute bd-bottom-4 bd-left-1/2 bd-z-50 bd-flex bd-w-full bd-max-w-md -bd-translate-x-1/2 bd-flex-col bd-items-center bd-gap-2 bd-px-4"
        >
          {toasts.map((item) => (
            <div
              key={item.id}
              role={item.tone === "error" ? "alert" : "status"}
              data-toast-tone={item.tone}
              className={`budde-toast bd-pointer-events-auto bd-flex bd-max-w-full bd-items-center bd-gap-2.5 bd-rounded-lg bd-border bd-px-3.5 bd-py-2.5 bd-text-control bd-shadow-sm bd-backdrop-blur-[12px] ${
                item.tone === "error"
                  ? "bd-border-destructive/40 bd-bg-card/95 bd-text-destructive"
                  : item.tone === "success"
                    ? "bd-border-border bd-bg-card/95 bd-text-foreground"
                    : "bd-border-border bd-bg-card/95 bd-text-foreground"
              }`}
            >
              <span
                className={
                  item.tone === "error"
                    ? "bd-text-destructive"
                    : item.tone === "success"
                      ? "bd-text-success"
                      : "bd-text-muted-foreground"
                }
              >
                <Icon
                  name={
                    item.tone === "error"
                      ? "alert"
                      : item.tone === "success"
                        ? "checkCircle"
                        : "circle"
                  }
                />
              </span>
              <span className="bd-min-w-0 bd-flex-1 bd-break-words">{item.message}</span>
              <button
                type="button"
                aria-label="关闭提示"
                onClick={() => dismissToast(item.id)}
                className="bd-inline-flex bd-h-6 bd-w-6 bd-shrink-0 bd-items-center bd-justify-center bd-rounded-sm bd-text-muted-foreground hover:bd-bg-muted hover:bd-text-foreground"
              >
                <Icon name="close" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(confirmRequest)}
        title={confirmRequest?.options.title ?? "确认操作"}
        description={confirmRequest?.options.description}
        maxWidthClass="bd-max-w-md"
        zIndexClass="bd-z-50"
        onClose={() => {
          if (confirmRequest) {
            confirmRequest.resolve(false);
            setConfirmRequest(null);
          }
        }}
      >
        {confirmRequest && (
          <div className="bd-space-y-4 bd-p-5">
            <div className="bd-space-y-1.5">
              <h3 className="bd-text-base bd-font-semibold bd-leading-6">
                {confirmRequest.options.title}
              </h3>
              <p className="bd-text-sm bd-leading-6 bd-text-muted-foreground">
                {confirmRequest.options.description}
              </p>
            </div>
            <div className="bd-flex bd-flex-wrap bd-justify-end bd-gap-2">
              <Button
                variant="outline"
                data-autofocus
                onClick={() => {
                  confirmRequest.resolve(false);
                  setConfirmRequest(null);
                }}
              >
                {confirmRequest.options.cancelLabel ?? "取消"}
              </Button>
              <Button
                variant={confirmRequest.options.destructive ? "destructive" : "default"}
                onClick={() => {
                  confirmRequest.resolve(true);
                  setConfirmRequest(null);
                }}
              >
                {confirmRequest.options.confirmLabel ?? "确认"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </BuddeContext.Provider>
  );
}
