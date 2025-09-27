import { writable } from 'svelte/store';

export type ToastVariant = 'default' | 'success' | 'error' | 'warning';

export type Toast = {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
};

export type ToastOptions = Omit<Toast, 'id'> & { id?: string };

function createToastStore() {
  const { subscribe, update, set } = writable<Toast[]>([]);

  const remove = (id: string) =>
    update((toasts) => toasts.filter((toast) => toast.id !== id));

  const push = (options: ToastOptions) => {
    const id = options.id ?? crypto.randomUUID();
    const toast: Toast = {
      id,
      title: options.title,
      description: options.description,
      variant: options.variant ?? 'default',
      duration: options.duration ?? 4000,
    };

    update((toasts) => [...toasts, toast]);

    if (toast.duration && toast.duration > 0) {
      setTimeout(() => remove(id), toast.duration);
    }

    return id;
  };

  const clear = () => set([]);

  return {
    subscribe,
    push,
    remove,
    clear,
  };
}

export const toasts = createToastStore();
