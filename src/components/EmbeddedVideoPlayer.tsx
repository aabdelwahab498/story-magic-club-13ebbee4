import { useMemo } from "react";

interface Props {
  url: string;
  title?: string;
  className?: string;
}

/** Detects YouTube / Vimeo / direct video links and returns an embeddable URL or null. */
function toEmbedUrl(url: string): { type: "iframe" | "video"; src: string } | null {
  try {
    const u = new URL(url);
    // YouTube (youtube.com/watch?v=ID, youtu.be/ID, youtube.com/shorts/ID)
    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return { type: "iframe", src: `https://www.youtube.com/embed/${v}` };
      const shorts = u.pathname.match(/\/shorts\/([^/?]+)/);
      if (shorts) return { type: "iframe", src: `https://www.youtube.com/embed/${shorts[1]}` };
      const embed = u.pathname.match(/\/embed\/([^/?]+)/);
      if (embed) return { type: "iframe", src: `https://www.youtube.com/embed/${embed[1]}` };
    }
    if (u.hostname === "youtu.be") {
      const id = u.pathname.replace("/", "");
      if (id) return { type: "iframe", src: `https://www.youtube.com/embed/${id}` };
    }
    // Vimeo
    if (u.hostname.includes("vimeo.com")) {
      const id = u.pathname.match(/\/(\d+)/)?.[1];
      if (id) return { type: "iframe", src: `https://player.vimeo.com/video/${id}` };
    }
    // Direct file
    if (/\.(mp4|webm|ogg|mov)$/i.test(u.pathname)) {
      return { type: "video", src: url };
    }
    // Fallback to iframe (some custom embed URLs)
    return { type: "iframe", src: url };
  } catch {
    return null;
  }
}

export default function EmbeddedVideoPlayer({ url, title, className }: Props) {
  const embed = useMemo(() => toEmbedUrl(url), [url]);
  if (!embed) return null;

  return (
    <div className={`relative w-full overflow-hidden rounded-2xl bg-black shadow-xl ${className ?? ""}`}>
      <div className="aspect-video w-full">
        {embed.type === "iframe" ? (
          <iframe
            src={embed.src}
            title={title ?? "Story video"}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
          />
        ) : (
          <video
            src={embed.src}
            controls
            playsInline
            className="h-full w-full object-contain"
          />
        )}
      </div>
    </div>
  );
}
