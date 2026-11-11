import type { Choice } from "./dialog";
import { usePart } from "./react-renderer";
import { DialogTitle, DialogDescription } from "./components/ui/dialog";
import { Button } from "./components/ui/button";
export function GuardView({ title, message, choices }: { title: string; message: string; choices: Choice[] }) {
  const part = usePart();
  return <div className="bd-space-y-4"><DialogTitle {...part('guard-title')}>{title}</DialogTitle><DialogDescription {...part('guard-message')}>{message}</DialogDescription><div className="guard-actions bd-flex bd-flex-wrap bd-justify-end bd-gap-2">{choices.map(choice => <Button key={choice.value} variant={choice.primary ? 'default' : 'outline'} data-choice={choice.value}>{choice.label}</Button>)}</div></div>;
}
