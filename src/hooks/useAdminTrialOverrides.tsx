import { useEffect, useState, useCallback } from "react";

export interface AdminTrialOverrides {
  pdf: boolean;
  audio: boolean;
  illustrations: boolean;
  createStory: boolean;
}

const STORAGE_KEY = "starry-tales-admin-trial-overrides";
const EVENT = "starry-tales-admin-trial-overrides-change";

const DEFAULTS: AdminTrialOverrides = {
  pdf: true,
  audio: true,
  illustrations: true,
  createStory: true,
};

function read(): AdminTrialOverrides {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

export function useAdminTrialOverrides() {
  const [overrides, setOverrides] = useState<AdminTrialOverrides>(read);

  useEffect(() => {
    const handler = () => setOverrides(read());
    window.addEventListener(EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const update = useCallback((patch: Partial<AdminTrialOverrides>) => {
    const next = { ...read(), ...patch };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setOverrides(next);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return { overrides, update };
}
