export interface RecoverableIllustration {
  page_index: number;
  image_url: string | null;
  status: string;
}

export function findRecoverablePages(
  illustrations: RecoverableIllustration[],
  expectedPages = 5,
): number[] {
  const ready = new Set(
    illustrations
      .filter((row) => row.status === "ready" && Boolean(row.image_url))
      .map((row) => row.page_index),
  );
  return Array.from({ length: expectedPages }, (_, offset) => offset + 1)
    .filter((pageIndex) => !ready.has(pageIndex));
}

export function buildRecoveryKey(storyId: string, pageIndexes: number[]): string {
  const signature = [...pageIndexes].sort((a, b) => a - b).join("-") || "missing";
  return `admin-recovery:${storyId}:${signature}`;
}