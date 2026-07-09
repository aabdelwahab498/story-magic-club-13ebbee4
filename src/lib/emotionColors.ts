// ============================================================================
// Emotion → color palettes  —  aligned with SEL bibliotherapy guidelines.
// Used by the PDF export UI and by the n8n workflow when composing the
// picture-book HTML template. Extend here; both surfaces read from one place.
// ============================================================================

export interface EmotionPalette {
  /** Primary color — headings, page numbers, spine accents. */
  primary: string;
  /** Secondary color — subtitles, borders. */
  secondary: string;
  /** Page background tint (very light). */
  background: string;
  /** Accent — badges, small decorations. */
  accent: string;
}

export const emotionPalettes: Record<string, EmotionPalette> = {
  fear:     { primary: "#6B4C9A", secondary: "#4A90E2", background: "#F0E6FF", accent: "#9B59B6" },
  courage:  { primary: "#E67E22", secondary: "#F39C12", background: "#FFF3E0", accent: "#D35400" },
  joy:      { primary: "#F1C40F", secondary: "#E74C3C", background: "#FFFDE7", accent: "#F39C12" },
  sadness:  { primary: "#3498DB", secondary: "#2980B9", background: "#EBF5FB", accent: "#5DADE2" },
  love:     { primary: "#E91E63", secondary: "#F48FB1", background: "#FCE4EC", accent: "#EC407A" },
  anger:    { primary: "#C0392B", secondary: "#E74C3C", background: "#FDEDEC", accent: "#A93226" },
  calm:     { primary: "#16A085", secondary: "#48C9B0", background: "#E8F8F5", accent: "#1ABC9C" },
  wonder:   { primary: "#8E44AD", secondary: "#BB8FCE", background: "#F4ECF7", accent: "#9B59B6" },
};

export const DEFAULT_PALETTE: EmotionPalette = emotionPalettes.joy;

/** Return the palette for the first recognized emotion, or the joy default. */
export function paletteFor(tags: string[] | undefined | null): EmotionPalette {
  if (!tags?.length) return DEFAULT_PALETTE;
  for (const t of tags) {
    const p = emotionPalettes[t.toLowerCase()];
    if (p) return p;
  }
  return DEFAULT_PALETTE;
}
