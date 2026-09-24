import { describe, expect, it } from "vitest";
import { buildRecoveryKey, findRecoverablePages } from "@/lib/illustrationRecovery";

describe("illustration recovery", () => {
  it("retries only missing and failed pages", () => {
    expect(findRecoverablePages([
      { page_index: 1, status: "ready", image_url: "https://example.test/1.jpg" },
      { page_index: 2, status: "failed", image_url: null },
      { page_index: 4, status: "ready", image_url: "https://example.test/4.jpg" },
      { page_index: 5, status: "ready", image_url: "" },
    ])).toEqual([2, 3, 5]);
  });

  it("returns no work when every image is usable", () => {
    const rows = Array.from({ length: 5 }, (_, offset) => ({
      page_index: offset + 1,
      status: "ready",
      image_url: `https://example.test/${offset + 1}.jpg`,
    }));
    expect(findRecoverablePages(rows)).toEqual([]);
  });

  it("uses a stable key for duplicate recovery clicks", () => {
    expect(buildRecoveryKey("story-1", [5, 2, 3])).toBe(buildRecoveryKey("story-1", [2, 3, 5]));
  });
});