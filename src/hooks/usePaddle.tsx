// Loads Paddle.js (v2) on demand, initializes with the public client token + env,
// and exposes a typed wrapper for opening the overlay checkout.
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

declare global {
  interface Window {
    Paddle?: any;
  }
}

const PADDLE_JS_URL = "https://cdn.paddle.com/paddle/v2/paddle.js";

type PaddleConfig = {
  clientToken: string;
  environment: "sandbox" | "production";
  plans: Array<{
    tier: string;
    paddle_price_id: string | null;
    paddle_product_id: string | null;
    price_usd: number;
    name: Record<string, string>;
  }>;
  configured: boolean;
};

let cachedConfig: PaddleConfig | null = null;
let loaderPromise: Promise<void> | null = null;

async function loadScript(): Promise<void> {
  if (window.Paddle) return;
  if (loaderPromise) return loaderPromise;
  loaderPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = PADDLE_JS_URL;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("paddle_js_failed_to_load"));
    document.head.appendChild(s);
  });
  return loaderPromise;
}

export function usePaddle() {
  const [config, setConfig] = useState<PaddleConfig | null>(cachedConfig);
  const [ready, setReady] = useState<boolean>(Boolean(cachedConfig && window.Paddle));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let cfg = cachedConfig;
        if (!cfg) {
          const { data, error: fnErr } = await supabase.functions.invoke<PaddleConfig>(
            "paddle-config",
            { method: "GET" },
          );
          if (fnErr) throw fnErr;
          if (!data) throw new Error("no_config");
          cfg = data;
          cachedConfig = cfg;
        }
        if (cancelled) return;
        setConfig(cfg);

        if (!cfg.configured) {
          setError("paddle_not_configured");
          return;
        }

        await loadScript();
        if (cancelled) return;

        if (window.Paddle && !window.Paddle.__initialized__) {
          window.Paddle.Environment.set(cfg.environment);
          window.Paddle.Initialize({ token: cfg.clientToken });
          window.Paddle.__initialized__ = true;
        }
        setReady(true);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "paddle_init_failed");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const openCheckout = useCallback(
    (opts: { priceId: string; email?: string; userId?: string; tier?: string }) => {
      if (!window.Paddle || !ready) {
        throw new Error("paddle_not_ready");
      }
      window.Paddle.Checkout.open({
        items: [{ priceId: opts.priceId, quantity: 1 }],
        customer: opts.email ? { email: opts.email } : undefined,
        customData: {
          user_id: opts.userId,
          tier: opts.tier,
        },
        settings: {
          displayMode: "overlay",
          theme: "light",
          successUrl: `${window.location.origin}/account?paddle=success`,
        },
      });
    },
    [ready],
  );

  return { config, ready, error, openCheckout };
}
