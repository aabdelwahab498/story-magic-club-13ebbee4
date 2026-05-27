// Client-side "video" exporter: paints story pages on a canvas synced with
// stitched audio, captures both via MediaRecorder, and returns a WebM blob.
// WebM is used because browsers don't reliably encode MP4 with MediaRecorder.
//
// Usage:
//   const blob = await renderStoryVideo({ audioUrl, pages, pageWeights });
//   downloadBlob(blob, "my-story.webm");

export interface VideoPage {
  text: string;
  image_url?: string | null;
}

export interface RenderOptions {
  audioUrl: string;
  pages: VideoPage[];
  pageWeights?: number[];
  width?: number;
  height?: number;
  title?: string;
  onProgress?: (pct: number) => void;
}

const loadImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });

const wrapText = (
  ctx: CanvasRenderingContext2D, text: string, maxWidth: number,
): string[] => {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
};

const drawFrame = (
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  img: HTMLImageElement | null,
  text: string,
  title: string,
  pageIdx: number,
  pageCount: number,
) => {
  // Background
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#0a0a23");
  grad.addColorStop(1, "#1a103d");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Image area (top 65%)
  const imgH = Math.floor(H * 0.65);
  if (img) {
    const ratio = Math.min(W / img.width, imgH / img.height);
    const iw = img.width * ratio;
    const ih = img.height * ratio;
    const ix = (W - iw) / 2;
    const iy = (imgH - ih) / 2 + 20;
    ctx.save();
    ctx.shadowColor = "rgba(255,255,255,0.25)";
    ctx.shadowBlur = 30;
    ctx.fillStyle = "#1a103d";
    ctx.fillRect(ix - 8, iy - 8, iw + 16, ih + 16);
    ctx.restore();
    ctx.drawImage(img, ix, iy, iw, ih);
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.fillRect(40, 60, W - 80, imgH - 40);
  }

  // Text area
  ctx.fillStyle = "#ffffff";
  ctx.font = "600 28px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.textBaseline = "top";
  ctx.textAlign = "center";
  const tx = W / 2;
  const ty = imgH + 30;
  const maxW = W - 120;
  const lines = wrapText(ctx, text, maxW).slice(0, 4);
  lines.forEach((ln, i) => ctx.fillText(ln, tx, ty + i * 38));

  // Footer
  ctx.font = "500 18px system-ui";
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.textAlign = "left";
  ctx.fillText(title, 24, H - 36);
  ctx.textAlign = "right";
  ctx.fillText(`${pageIdx + 1} / ${pageCount}`, W - 24, H - 36);
};

export async function renderStoryVideo(opts: RenderOptions): Promise<Blob> {
  const W = opts.width ?? 1280;
  const H = opts.height ?? 720;
  const title = opts.title ?? "";

  // Preload audio + images
  const audio = new Audio();
  audio.crossOrigin = "anonymous";
  audio.src = opts.audioUrl;
  audio.preload = "auto";
  await new Promise<void>((resolve, reject) => {
    audio.onloadedmetadata = () => resolve();
    audio.onerror = () => reject(new Error("audio_load_failed"));
  });
  const duration = audio.duration;
  if (!isFinite(duration) || duration <= 0) throw new Error("invalid_audio_duration");

  const imgs = await Promise.all(opts.pages.map(async (p) =>
    p.image_url ? await loadImage(p.image_url).catch(() => null) : null
  ));

  // Cumulative time markers (s) — page i ends at markers[i]
  const wRaw = opts.pageWeights && opts.pageWeights.length === opts.pages.length
    ? opts.pageWeights
    : opts.pages.map(() => 1);
  const totW = wRaw.reduce((s, n) => s + n, 0) || 1;
  let acc = 0;
  const markers = wRaw.map((x) => { acc += (x / totW) * duration; return acc; });

  // Canvas + recorder
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const canvasStream = (canvas as any).captureStream(30) as MediaStream;

  // Audio routing
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioCtx = new AC();
  const srcNode = audioCtx.createMediaElementSource(audio);
  const dest = audioCtx.createMediaStreamDestination();
  srcNode.connect(dest);
  srcNode.connect(audioCtx.destination); // playback so user hears it
  dest.stream.getAudioTracks().forEach((t) => canvasStream.addTrack(t));

  const mimeCandidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  const mimeType = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || "video/webm";
  const recorder = new MediaRecorder(canvasStream, { mimeType, videoBitsPerSecond: 2_500_000 });
  const blobs: Blob[] = [];
  recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) blobs.push(e.data); };

  const finalBlob = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(blobs, { type: mimeType }));
  });

  // Drive animation while audio plays
  let rafId = 0;
  const tick = () => {
    const t = audio.currentTime;
    let idx = markers.findIndex((m) => t < m);
    if (idx < 0) idx = opts.pages.length - 1;
    drawFrame(ctx, W, H, imgs[idx], opts.pages[idx].text, title, idx, opts.pages.length);
    opts.onProgress?.(Math.min(1, t / duration));
    rafId = requestAnimationFrame(tick);
  };

  audio.currentTime = 0;
  await audioCtx.resume();
  recorder.start(250);
  tick();
  await audio.play();

  await new Promise<void>((resolve) => {
    audio.onended = () => resolve();
  });
  cancelAnimationFrame(rafId);
  // Draw one last frame
  drawFrame(ctx, W, H, imgs[imgs.length - 1], opts.pages[opts.pages.length - 1].text,
    title, opts.pages.length - 1, opts.pages.length);
  await new Promise((r) => setTimeout(r, 250));
  recorder.stop();
  audioCtx.close().catch(() => {});
  return finalBlob;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
