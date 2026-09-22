// Guarded service worker registration for Lovable.
// Only registers in production, real origins, never inside iframe/preview.
import { toast } from "sonner";
import { setPendingSwUpdate, applyPendingSwUpdate } from "./swUpdate";
import { isBusy } from "./busy";

const SW_URL = "/sw.js";

function isPreviewHost(host: string): boolean {
  return (
    host.startsWith("id-preview--") ||
    host.startsWith("preview--") ||
    host === "lovableproject.com" ||
    host.endsWith(".lovableproject.com") ||
    host === "lovableproject-dev.com" ||
    host.endsWith(".lovableproject-dev.com") ||
    host === "beta.lovable.dev" ||
    host.endsWith(".beta.lovable.dev")
  );
}

async function unregisterMatching() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      regs
        .filter((r) => {
          const url = r.active?.scriptURL || r.waiting?.scriptURL || r.installing?.scriptURL || "";
          return url.endsWith(SW_URL);
        })
        .map((r) => r.unregister()),
    );
  } catch {
    /* ignore */
  }
}

export async function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  const inIframe = window.self !== window.top;
  const host = window.location.hostname;
  const killSwitch = new URLSearchParams(window.location.search).get("sw") === "off";

  if (!import.meta.env.PROD || inIframe || isPreviewHost(host) || killSwitch) {
    await unregisterMatching();
    return;
  }

  try {
    const { Workbox } = await import("workbox-window");
    const wb = new Workbox(SW_URL, { scope: "/" });

    wb.addEventListener("waiting", () => {
      // Defer the update — store it and surface a non-blocking toast.
      // Auto-applies on `story:ended` event, or the user can apply now.
      setPendingSwUpdate(wb);
      toast("تحديث جديد متاح", {
        description:
          "سيتم تطبيق التحديث تلقائياً بعد انتهاء القصة الحالية، أو اضغط لتحديث الآن.",
        action: {
          label: "تحديث الآن",
          onClick: () => applyPendingSwUpdate(),
        },
        duration: 12000,
      });
    });

    // A new worker that took control means the cached bundle is stale:
    // reload once so the freshly published code is actually running.
    let reloaded = false;
    wb.addEventListener("controlling", (event: Event & { isUpdate?: boolean }) => {
      if (reloaded) return;
      // First-ever install claims the page immediately (clientsClaim). That is
      // NOT a stale bundle — reloading there killed in-flight story generation
      // on the published site. Only a real update warrants a reload.
      if (!event.isUpdate) return;
      reloaded = true;
      const reloadWhenIdle = () => {
        if (isBusy()) {
          window.setTimeout(reloadWhenIdle, 3000);
          return;
        }
        window.location.reload();
      };
      reloadWhenIdle();
    });

    await wb.register();
  } catch (err) {
    console.warn("[pwa] SW registration failed", err);
  }
}
