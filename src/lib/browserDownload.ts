export type PreparedDownloadTarget = Window | null;

function getDownloadContext() {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !("MSStream" in window);
  const isAndroid = /Android/i.test(ua);
  const isMobile = isIOS || isAndroid || /Mobile|Tablet/i.test(ua);
  const isSafari = /Safari/i.test(ua) && !/Chrome|CriOS|Chromium|Edg|OPR|Firefox/i.test(ua);
  const inIframe = (() => {
    try { return window.self !== window.top; } catch { return true; }
  })();

  return { inIframe, isIOS, isAndroid, isMobile, isSafari };
}

export function shouldUseDownloadFallback() {
  const ctx = getDownloadContext();
  return ctx.inIframe || ctx.isIOS || ctx.isAndroid || (ctx.isMobile && ctx.isSafari);
}

export function prepareDownloadTarget(): PreparedDownloadTarget {
  if (typeof window === "undefined" || !shouldUseDownloadFallback()) return null;

  try {
    const target = window.open("", "_blank");
    if (!target) return null;
    try { target.opener = null; } catch { /* ignore */ }
    try {
      target.document.title = "Preparing download";
      target.document.body.style.margin = "0";
      target.document.body.style.fontFamily = "system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
      target.document.body.innerHTML =
        '<main style="min-height:100vh;display:grid;place-items:center;background:#fff;color:#111;padding:24px;text-align:center"><p style="font-size:18px;margin:0">Preparing your download…</p></main>';
    } catch { /* cross-browser best effort */ }
    return target;
  } catch {
    return null;
  }
}

function closeUnusedTarget(target?: PreparedDownloadTarget) {
  try {
    if (target && !target.closed && target.location.href === "about:blank") target.close();
  } catch { /* ignore */ }
}

function openHref(href: string, target?: PreparedDownloadTarget): boolean {
  if (target && !target.closed) {
    try {
      target.location.href = href;
      return true;
    } catch { /* continue */ }
  }

  try {
    const opened = window.open(href, "_blank", "noopener,noreferrer");
    if (opened) return true;
  } catch { /* continue */ }

  try {
    (window.top ?? window).location.href = href;
    return true;
  } catch {
    try {
      window.location.href = href;
      return true;
    } catch {
      return false;
    }
  }
}

export function downloadBlob(blob: Blob, filename: string, target?: PreparedDownloadTarget) {
  const ctx = getDownloadContext();
  const openInsteadOfDownload = ctx.inIframe || ctx.isIOS || ctx.isAndroid || (ctx.isMobile && ctx.isSafari);

  if (openInsteadOfDownload) {
    if (ctx.isIOS && blob.type === "application/pdf") {
      const reader = new FileReader();
      reader.onloadend = () => openHref(reader.result as string, target);
      reader.onerror = () => closeUnusedTarget(target);
      reader.readAsDataURL(blob);
      return;
    }

    const url = URL.createObjectURL(blob);
    openHref(url, target);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return;
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  closeUnusedTarget(target);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}