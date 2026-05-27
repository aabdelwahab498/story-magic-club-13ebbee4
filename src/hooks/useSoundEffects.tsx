import { useCallback, useEffect, useRef } from "react";

/**
 * Lightweight WebAudio sound effects — no asset downloads required.
 * Plays gentle, kid-friendly "pop" and "sparkle" tones on hover/click.
 */
type SoundType = "hover" | "click" | "sparkle";

let sharedCtx: AudioContext | null = null;
let muted = false;
let lastHover = 0;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!sharedCtx) {
    const Ctx =
      (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    sharedCtx = new Ctx();
  }
  return sharedCtx;
}

function tone(freq: number, duration: number, type: OscillatorType = "sine", gain = 0.06) {
  const ctx = getCtx();
  if (!ctx || muted) return;
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  g.gain.setValueAtTime(0, ctx.currentTime);
  g.gain.linearRampToValueAtTime(gain, ctx.currentTime + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
  osc.connect(g).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration);
}

export function playSound(kind: SoundType) {
  if (kind === "hover") {
    const now = Date.now();
    if (now - lastHover < 80) return; // throttle
    lastHover = now;
    tone(880, 0.08, "sine", 0.03);
  } else if (kind === "click") {
    tone(523.25, 0.09, "triangle", 0.07);
    setTimeout(() => tone(783.99, 0.12, "triangle", 0.06), 60);
  } else if (kind === "sparkle") {
    [1046.5, 1318.5, 1568].forEach((f, i) =>
      setTimeout(() => tone(f, 0.12, "sine", 0.05), i * 70)
    );
  }
}

export function setSoundMuted(value: boolean) {
  muted = value;
  if (typeof window !== "undefined") {
    localStorage.setItem("starry-tales-muted", value ? "1" : "0");
  }
}

export function isSoundMuted() {
  return muted;
}

/**
 * Hook returning hover/click handlers you can spread onto a button or card.
 */
export function useSoundEffects() {
  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    if (typeof window !== "undefined") {
      muted = localStorage.getItem("starry-tales-muted") === "1";
    }
  }, []);

  const onMouseEnter = useCallback(() => playSound("hover"), []);
  const onClick = useCallback(() => playSound("click"), []);

  return { onMouseEnter, onClick, playSound };
}
