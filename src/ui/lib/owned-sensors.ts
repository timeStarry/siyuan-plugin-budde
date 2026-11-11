import { useCallback, useLayoutEffect, useRef } from 'react';
import { KeyboardSensor, PointerSensor, useSensor, useSensors, type KeyboardCoordinateGetter, type KeyboardSensorOptions, type PointerSensorOptions, type SensorProps } from '@dnd-kit/core';

type Owned<T> = T & { root: HTMLElement; register(dispose: () => void): void };
type ListenerSet = { add(...args: unknown[]): void; removeAll(): void };
// dnd-kit 6.3.1 has no public sensor disposal API and DndContext does not
// detach active sensors on unmount. Keep its private compatibility seam here,
// not in views/controllers. verify-react-host exercises both input modalities,
// view switches and destruction, including document/window listener ownership.
type Cancellable = { handleCancel(event: Event): void; listeners: ListenerSet; documentListeners?: ListenerSet };
function own<T extends PointerSensorOptions | KeyboardSensorOptions>(props: SensorProps<Owned<T>>) {
  let live = true;
  let releaseFocus = () => {};
  const finish = (callback: () => void) => { if (live) { live = false; releaseFocus(); callback(); } };
  return {
    props: { ...props, onEnd() { finish(props.onEnd); }, onCancel() { finish(props.onCancel); } },
    attach(sensor: PointerSensor | KeyboardSensor) {
      const internal = sensor as unknown as Cancellable;
      // KeyboardSensor schedules its key listener for the next task. Prevent
      // that scheduled registration resurrecting a disposed sensor.
      const add = internal.listeners.add.bind(internal.listeners);
      internal.listeners.add = (...args) => { if (live) add(...args); };
      const dispose = () => {
        if (live) internal.handleCancel(new KeyboardEvent('keydown', { code: 'Escape', cancelable: true }));
        releaseFocus();
        // PointerSensor delays document cleanup to suppress the post-drop
        // click. On pane disposal there must be no host-global click blocker.
        internal.documentListeners?.removeAll();
        internal.listeners.removeAll();
      };
      // Document-level sensor keys must stop as soon as another host control
      // or another Budde instance receives focus, even if this Board survives.
      const document = props.options.root.ownerDocument;
      const focus = (event: FocusEvent) => { if (!props.options.root.contains(event.target as Node) || (props.event instanceof KeyboardEvent && event.target !== props.event.target)) dispose(); };
      document.addEventListener('focusin', focus, true);
      releaseFocus = () => document.removeEventListener('focusin', focus, true);
      props.options.register(dispose);
    },
  };
}
class OwnedPointerSensor extends PointerSensor {
  constructor(props: SensorProps<Owned<PointerSensorOptions>>) { const owner = own(props); super(owner.props); owner.attach(this); }
}
class OwnedKeyboardSensor extends KeyboardSensor {
  constructor(props: SensorProps<Owned<KeyboardSensorOptions>>) {
    // KeyboardSensor also performs scrolling independently of autoScroll.
    // Keep its ancestor list local without mutating DndContext's shared ref.
    const context = { get current() { const current = props.context.current; return { ...current, scrollableAncestors: current.scrollableAncestors.filter(element => element === props.options.root.querySelector('[data-part="collection"]')) }; } };
    const owner = own({ ...props, context }); super(owner.props); owner.attach(this);
  }
}
export function useOwnedSensors(root: HTMLElement, coordinateGetter: KeyboardCoordinateGetter) {
  const dispose = useRef<(() => void) | null>(null);
  const register = useCallback((release: () => void) => { dispose.current?.(); dispose.current = release; }, []);
  useLayoutEffect(() => () => { dispose.current?.(); dispose.current = null; }, []);
  return useSensors(useSensor(OwnedPointerSensor, { root, register, activationConstraint: { distance: 6 } }), useSensor(OwnedKeyboardSensor, { root, register, coordinateGetter }));
}
