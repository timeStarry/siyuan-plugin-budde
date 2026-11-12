import { useEffect, useRef, useState } from "react";
import type { BuddeClient, BuddeState } from "../core/types";
import { CaptureRequest } from "./model";
import { Icon } from "./components/icons";
import { Button } from "./components/ui/button";
import { Input, NativeSelect, Textarea } from "./components/ui/fields";

export function QuickCaptureBox({
  client,
  onSuccess,
  onCancel,
  onOpenWorkbench,
}: {
  client: BuddeClient;
  onSuccess(title: string, active: boolean): void;
  onCancel(): void;
  onOpenWorkbench(): void;
}) {
  const [state, setState] = useState<BuddeState | null>(null);
  const [title, setTitle] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [typeId, setTypeId] = useState("general");
  const [directActive, setDirectActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const composingRef = useRef(false);
  const reqRef = useRef(new CaptureRequest());

  useEffect(() => {
    let alive = true;
    void client
      .snapshot()
      .then((snap) => {
        if (!alive) return;
        setState(snap);
        const def = snap.types.find((t) => t.id === "general") ?? snap.types[0];
        if (def) setTypeId(def.id);
      })
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : String(err));
      });
    setTimeout(() => inputRef.current?.focus(), 20);
    return () => {
      alive = false;
    };
  }, [client]);

  const submit = async () => {
    if (composingRef.current || busy || !title.trim()) return;
    setBusy(true);
    setError("");
    try {
      const cmd = reqRef.current.prepare({
        title: title.trim(),
        typeId: state ? typeId : undefined,
        status: directActive ? "active" : "pool",
      });
      if (nextStep.trim()) cmd.nextStep = nextStep.trim();
      await client.execute(cmd);
      reqRef.current.success();
      onSuccess(title.trim(), directActive);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <form
      onCompositionStart={() => {
        composingRef.current = true;
      }}
      onCompositionEnd={() => {
        composingRef.current = false;
      }}
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      onKeyDown={(e) => {
        if (composingRef.current || e.nativeEvent.isComposing || e.keyCode === 229) return;
        if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        }
      }}
      className="bd-w-full bd-space-y-3 bd-rounded-lg bd-border bd-border-border bd-bg-card bd-p-4 bd-text-foreground bd-shadow-lift"
    >
      <div className="bd-flex bd-items-center bd-justify-between bd-gap-2">
        <div className="bd-flex bd-items-center bd-gap-2">
          <Icon name="brand" />
          <span className="bd-font-brand bd-text-base bd-font-semibold">Budde</span>
          <span className="bd-text-xs bd-text-muted-foreground">快速记录</span>
        </div>
        <Button size="sm" variant="ghost" onClick={onOpenWorkbench} className="bd-h-7 bd-text-xs">
          打开完整工作台
          <Icon name="open" />
        </Button>
      </div>

      <Input
        ref={inputRef}
        data-part="quick-capture-input"
        aria-label="想法标题"
        placeholder="记下一个想法，按 Enter 保存，Esc 关闭…"
        maxLength={500}
        value={title}
        disabled={busy}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (
            e.key === "Enter" &&
            (composingRef.current || e.nativeEvent.isComposing || e.keyCode === 229)
          ) {
            e.preventDefault();
          }
        }}
        className="bd-h-10 bd-text-sm"
      />

      {showMore && (
        <Textarea
          aria-label="下一步（可选）"
          placeholder="可选：顺手记下下一步要做的具体动作…"
          rows={2}
          value={nextStep}
          disabled={busy}
          onChange={(e) => setNextStep(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              void submit();
            }
          }}
          className="bd-min-h-16 bd-text-xs"
        />
      )}

      {error && (
        <p role="alert" className="bd-text-xs bd-text-destructive">
          {error}
        </p>
      )}

      <div className="bd-flex bd-flex-wrap bd-items-center bd-justify-between bd-gap-2">
        <div className="bd-flex bd-items-center bd-gap-1.5">
          {state && (
            <NativeSelect
              aria-label="事项类型"
              value={typeId}
              disabled={busy}
              onChange={(e) => setTypeId(e.target.value)}
              className="bd-h-8 bd-w-28 bd-text-xs"
            >
              {state.types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </NativeSelect>
          )}
          <Button
            size="sm"
            variant="ghost"
            aria-pressed={directActive}
            onClick={() => setDirectActive(!directActive)}
            className="bd-h-8 bd-px-2 bd-text-xs"
          >
            <Icon name={directActive ? "active" : "pool"} />
            {directActive ? "直接推进" : "存想法池"}
          </Button>
          {!showMore && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowMore(true)}
              className="bd-h-8 bd-px-2 bd-text-xs"
            >
              + 下一步
            </Button>
          )}
        </div>

        <div className="bd-flex bd-items-center bd-gap-1.5">
          <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}>
            取消
          </Button>
          <Button size="sm" type="submit" disabled={busy || !title.trim()}>
            {busy ? "保存中…" : "记下来 ↵"}
          </Button>
        </div>
      </div>
    </form>
  );
}
