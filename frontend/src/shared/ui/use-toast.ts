import { useState, useCallback } from 'react';

export type ToastVariant = 'default' | 'destructive' | 'success';

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
}

type ToastInput = Omit<Toast, 'id'>;

let toastListeners: ((toasts: Toast[]) => void)[] = [];
let toastQueue: Toast[] = [];

function notifyListeners() {
  toastListeners.forEach((fn) => fn([...toastQueue]));
}

export function toast(input: ToastInput) {
  const id = Math.random().toString(36).slice(2);
  const t: Toast = { id, variant: 'default', ...input };
  toastQueue = [...toastQueue, t];
  notifyListeners();
  setTimeout(() => {
    toastQueue = toastQueue.filter((x) => x.id !== id);
    notifyListeners();
  }, 4000);
}

export function useToastStore() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const subscribe = useCallback(() => {
    toastListeners.push(setToasts);
    setToasts([...toastQueue]);
    return () => {
      toastListeners = toastListeners.filter((fn) => fn !== setToasts);
    };
  }, []);

  return { toasts, subscribe };
}

export function dismiss(id: string) {
  toastQueue = toastQueue.filter((t) => t.id !== id);
  notifyListeners();
}
