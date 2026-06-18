import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const REMEMBER_KEY = "admin-remember";
const LAST_ACTIVITY_KEY = "admin-last-activity";

// Idle limits: short for normal sign-in, long for "Remember me".
const IDLE_MS_DEFAULT = 30 * 60 * 1000; // 30 min
const IDLE_MS_REMEMBERED = 7 * 24 * 60 * 60 * 1000; // 7 days

export function setAdminRemember(value: boolean) {
  try {
    localStorage.setItem(REMEMBER_KEY, value ? "1" : "0");
  } catch {
    /* noop */
  }
}

export function getAdminRemember(): boolean {
  try {
    return localStorage.getItem(REMEMBER_KEY) === "1";
  } catch {
    return false;
  }
}

function markActivity() {
  try {
    localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
  } catch {
    /* noop */
  }
}

/**
 * Tracks admin activity. If the user is idle longer than the configured
 * timeout, sign them out and redirect to /admin/auth.
 * Also enforces the timeout on page load (so closing the browser logs them out
 * unless "Remember me" was checked).
 */
export function useAdminSession() {
  const navigate = useNavigate();
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const limit = getAdminRemember() ? IDLE_MS_REMEMBERED : IDLE_MS_DEFAULT;

    const signOutForIdle = async () => {
      try {
        await supabase.auth.signOut();
      } catch {
        /* noop */
      }
      try {
        localStorage.removeItem(LAST_ACTIVITY_KEY);
      } catch {
        /* noop */
      }
      toast.error("Session expired — please sign in again", { duration: 6000 });
      navigate("/admin/auth", { replace: true });
    };

    // 1) On mount, enforce idle limit against last-known activity timestamp.
    try {
      const last = Number(localStorage.getItem(LAST_ACTIVITY_KEY) || 0);
      if (last > 0 && Date.now() - last > limit) {
        void signOutForIdle();
        return;
      }
    } catch {
      /* noop */
    }
    markActivity();

    // 2) Schedule idle timer; reset on user activity.
    const reset = () => {
      markActivity();
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        void signOutForIdle();
      }, limit);
    };

    const events: Array<keyof WindowEventMap> = [
      "mousemove",
      "keydown",
      "click",
      "scroll",
      "touchstart",
      "visibilitychange",
    ];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [navigate]);
}

export async function adminSignOut(navigate: (p: string, opts?: { replace?: boolean }) => void) {
  try {
    await supabase.auth.signOut();
  } catch {
    /* noop */
  }
  try {
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    localStorage.removeItem(REMEMBER_KEY);
  } catch {
    /* noop */
  }
  toast.success("Signed out");
  navigate("/admin/auth", { replace: true });
}
