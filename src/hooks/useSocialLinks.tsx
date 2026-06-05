import { useEffect, useState, useCallback } from "react";

export type SocialPlatform =
  | "facebook"
  | "instagram"
  | "youtube"
  | "tiktok"
  | "pinterest"
  | "reddit"
  | "amazon";

export type SocialLinks = Record<SocialPlatform, string>;

export const SOCIAL_PLATFORMS: SocialPlatform[] = [
  "facebook",
  "instagram",
  "youtube",
  "tiktok",
  "pinterest",
  "reddit",
  "amazon",
];

const STORAGE_KEY = "najmah:social_links:v2";

const DEFAULTS: SocialLinks = {
  facebook: "",
  instagram: "",
  youtube: "",
  tiktok: "",
  pinterest: "",
  reddit: "",
  amazon: "",
};

const read = (): SocialLinks => {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<SocialLinks>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return DEFAULTS;
  }
};

/**
 * Hook for reading social links from localStorage.
 * Reflects updates across tabs/components via storage + custom events.
 */
export const useSocialLinks = () => {
  const [links, setLinks] = useState<SocialLinks>(read);

  useEffect(() => {
    const sync = () => setLinks(read());
    window.addEventListener("storage", sync);
    window.addEventListener("najmah:social_links_updated", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("najmah:social_links_updated", sync);
    };
  }, []);

  const save = useCallback((next: SocialLinks) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setLinks(next);
    window.dispatchEvent(new Event("najmah:social_links_updated"));
  }, []);

  return { links, save };
};
