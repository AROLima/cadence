// Simple Svelte action to handle click-outside behavior
// Usage: <div use:clickOutside={{ enabled: isOpen, handler: () => (isOpen = false) }} />
export type ClickOutsideParams = {
  enabled: boolean;
  handler: () => void;
};

export function clickOutside(node: HTMLElement, params: ClickOutsideParams) {
  function onClick(event: MouseEvent) {
    if (!params?.enabled) return;
    const target = event.target as Node | null;
    if (target && !node.contains(target)) {
      // Call handler; swallow any user-land errors silently
      try {
        params.handler?.();
      } catch {
        // ignore errors from handler
      }
    }
  }

  document.addEventListener('click', onClick, true);

  return {
    update(newParams: ClickOutsideParams) {
      params = newParams;
    },
    destroy() {
      document.removeEventListener('click', onClick, true);
    },
  };
}
