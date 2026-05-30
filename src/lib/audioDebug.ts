/**
 * Lightweight audio debugging utility.
 *
 * - Records pause/resume events (with saved + actual currentTime) to an in-memory
 *   ring buffer that <AudioDebugPanel> subscribes to.
 * - Provides resumeAudio(): a cross-browser safe resume that handles iOS Safari's
 *   constraint that currentTime cannot be set before metadata is loaded.
 * - All logs are also mirrored to console.debug with a [Audio] prefix so they show
 *   up in DevTools across Chrome / Safari / Firefox.
 */

export type AudioDebugEvent = {
  ts: number;
  source: string;            // e.g. "Narrator/HD", "SelViewer"
  kind:
    | "pause"
    | "resume-request"
    | "resume-restored"
    | "resume-deferred"      // waiting for loadedmetadata (iOS)
    | "resume-playing"
    | "play-rejected"
    | "ended"
    | "error"
    | "info";
  saved?: number;            // position we saved on pause
  before?: number;           // currentTime before restore
  after?: number;            // currentTime after restore
  duration?: number;
  readyState?: number;
  message?: string;
};

const MAX = 100;
const buffer: AudioDebugEvent[] = [];
const listeners = new Set<(evts: AudioDebugEvent[]) => void>();

function getBrowser(): string {
  if (typeof navigator === "undefined") return "ssr";
  const ua = navigator.userAgent;
  if (/CriOS|Chrome\//.test(ua) && !/Edg\//.test(ua)) return "Chrome";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Safari\//.test(ua) && !/Chrome|CriOS/.test(ua)) return "Safari";
  if (/Edg\//.test(ua)) return "Edge";
  return "Other";
}

export const browserName = getBrowser();

export function logAudio(evt: Omit<AudioDebugEvent, "ts">) {
  const full: AudioDebugEvent = { ts: Date.now(), ...evt };
  buffer.push(full);
  if (buffer.length > MAX) buffer.shift();
  // mirror to console
  // eslint-disable-next-line no-console
  console.debug(
    `[Audio][${browserName}][${full.source}] ${full.kind}`,
    {
      saved: full.saved?.toFixed?.(3),
      before: full.before?.toFixed?.(3),
      after: full.after?.toFixed?.(3),
      duration: full.duration,
      readyState: full.readyState,
      message: full.message,
    },
  );
  for (const l of listeners) l([...buffer]);
}

export function subscribeAudioLog(fn: (evts: AudioDebugEvent[]) => void): () => void {
  listeners.add(fn);
  fn([...buffer]);
  return () => listeners.delete(fn);
}

export function clearAudioLog() {
  buffer.length = 0;
  for (const l of listeners) l([]);
}

/**
 * Pause an <audio> element while preserving its currentTime in a ref.
 * Returns the captured position.
 */
export function pauseAudio(
  el: HTMLAudioElement,
  positionRef: { current: number },
  source: string,
): number {
  const pos = el.currentTime || 0;
  positionRef.current = pos;
  logAudio({
    source,
    kind: "pause",
    saved: pos,
    duration: el.duration,
    readyState: el.readyState,
  });
  try {
    el.pause();
  } catch (err) {
    logAudio({ source, kind: "error", message: `pause() threw: ${String(err)}` });
  }
  return pos;
}

/**
 * Resume playback from a saved position on the SAME <audio> instance.
 *
 * Handles the iOS Safari constraint where setting `currentTime` before
 * metadata is loaded silently fails (or throws), causing playback to
 * restart from 0. When readyState < HAVE_METADATA (1) we wait for the
 * `loadedmetadata` event before seeking and calling play().
 */
export function resumeAudio(
  el: HTMLAudioElement,
  positionRef: { current: number },
  source: string,
): void {
  const saved = positionRef.current;
  const before = el.currentTime;

  logAudio({
    source,
    kind: "resume-request",
    saved,
    before,
    duration: el.duration,
    readyState: el.readyState,
  });

  const seekAndPlay = () => {
    const beforeSeek = el.currentTime;
    try {
      if (saved > 0 && Math.abs(el.currentTime - saved) > 0.25) {
        el.currentTime = saved;
      }
    } catch (err) {
      logAudio({
        source,
        kind: "error",
        saved,
        before: beforeSeek,
        message: `currentTime restore failed: ${String(err)}`,
      });
    }
    logAudio({
      source,
      kind: "resume-restored",
      saved,
      before: beforeSeek,
      after: el.currentTime,
      readyState: el.readyState,
    });
    const playPromise = el.play();
    if (playPromise && typeof playPromise.then === "function") {
      playPromise
        .then(() => {
          logAudio({
            source,
            kind: "resume-playing",
            saved,
            after: el.currentTime,
          });
        })
        .catch((err) => {
          logAudio({
            source,
            kind: "play-rejected",
            saved,
            after: el.currentTime,
            message: String(err?.message ?? err),
          });
        });
    }
  };

  // iOS Safari: cannot set currentTime until metadata is loaded.
  // HTMLMediaElement.HAVE_METADATA === 1
  if (el.readyState < 1) {
    logAudio({
      source,
      kind: "resume-deferred",
      saved,
      readyState: el.readyState,
      message: "waiting for loadedmetadata",
    });
    const onMeta = () => {
      el.removeEventListener("loadedmetadata", onMeta);
      seekAndPlay();
    };
    el.addEventListener("loadedmetadata", onMeta, { once: true });
    // Nudge the element to load metadata if it hasn't started.
    try {
      el.load();
    } catch {
      /* ignore */
    }
  } else {
    seekAndPlay();
  }
}

export function isAudioDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (new URLSearchParams(window.location.search).get("audioDebug") === "1") return true;
    return window.localStorage.getItem("starry-tales-audio-debug") === "1";
  } catch {
    return false;
  }
}

export function setAudioDebugEnabled(on: boolean) {
  try {
    window.localStorage.setItem("starry-tales-audio-debug", on ? "1" : "0");
  } catch {
    /* ignore */
  }
}
