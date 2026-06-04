// Defers Service Worker updates until a safe moment (e.g. story ended).
// Workbox waiting -> store pending instance -> wait for `story:ended` or manual apply.
import type { Workbox } from "workbox-window";

type Listener = (pending: boolean) => void;

let pending: Workbox | null = null;
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l(!!pending);
}

export function subscribeSwUpdate(l: Listener): () => void {
  listeners.add(l);
  l(!!pending);
  return () => listeners.delete(l);
}

export function hasPendingSwUpdate(): boolean {
  return !!pending;
}

export function setPendingSwUpdate(wb: Workbox) {
  pending = wb;
  emit();
}

export function applyPendingSwUpdate() {
  if (!pending) return;
  const wb = pending;
  wb.addEventListener("controlling", () => {
    window.location.reload();
  });
  wb.messageSkipWaiting();
  pending = null;
  emit();
}

// Auto-apply when a "safe" event fires — after a story ends.
if (typeof window !== "undefined") {
  window.addEventListener("story:ended", () => {
    if (pending) {
      // small delay so any closing UI/toast can render
      setTimeout(() => applyPendingSwUpdate(), 800);
    }
  });
}
