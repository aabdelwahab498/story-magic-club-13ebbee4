// Tracks whether a long-running user flow (story generation, illustrations,
// PDF export) is in progress, so the service worker never reloads the page
// underneath it and wipes in-flight state.

const KEY = "__najmahBusy";

export function markBusy(busy: boolean): void {
  if (typeof window === "undefined") return;
  (window as unknown as Record<string, unknown>)[KEY] = busy;
}

export function isBusy(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window as unknown as Record<string, unknown>)[KEY];
}
