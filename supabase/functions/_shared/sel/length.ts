// Length & structural checks against age-band targets.

import { AGE_BANDS, type AgeBand } from "./constants.ts";

export interface LengthCheck {
  passed: boolean;
  pageCount: number;
  pageRange: [number, number];
  avgSentenceWords: number;
  sentenceWordRange: [number, number];
  issues: string[];
}

export function checkLength(
  pages: { text: string }[],
  ageBand: AgeBand,
): LengthCheck {
  const band = AGE_BANDS[ageBand];
  const issues: string[] = [];
  const pageCount = pages.length;
  if (pageCount < band.pages[0] || pageCount > band.pages[1]) {
    issues.push(
      `page-count ${pageCount} outside [${band.pages[0]}, ${band.pages[1]}]`,
    );
  }
  const allWords: number[] = [];
  for (const p of pages) {
    const sentences = p.text.split(/[.!?؟…]+/).filter((s) => s.trim().length);
    for (const s of sentences) {
      allWords.push(s.trim().split(/\s+/).length);
    }
  }
  const avg = allWords.length
    ? allWords.reduce((a, b) => a + b, 0) / allWords.length
    : 0;
  if (avg < band.sentenceWords[0] - 2 || avg > band.sentenceWords[1] + 2) {
    issues.push(
      `avg sentence ${avg.toFixed(1)} words outside [${band.sentenceWords[0]}, ${band.sentenceWords[1]}]`,
    );
  }
  return {
    passed: issues.length === 0,
    pageCount,
    pageRange: band.pages as [number, number],
    avgSentenceWords: Number(avg.toFixed(1)),
    sentenceWordRange: band.sentenceWords as [number, number],
    issues,
  };
}
