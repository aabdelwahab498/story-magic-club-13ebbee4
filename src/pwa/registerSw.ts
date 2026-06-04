// Guarded service worker registration for Lovable.
// Only registers in production, real origins, never inside iframe/preview.
import { toast } from "sonner";

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
      // New version ready — tell SW to skip waiting then reload
      toast("تحديث جديد متاح", {
        description: "اضغط لتحديث التطبيق إلى أحدث إصدار.",
        action: {
          label: "تحديث",
          onClick: () => {
            wb.addEventListener("controlling", () => window.location.reload());
            wb.messageSkipWaiting();
          },
        },
        duration: 10000,
      });
    });

    await wb.register();
  } catch (err) {
    console.warn("[pwa] SW registration failed", err);
  }
}
