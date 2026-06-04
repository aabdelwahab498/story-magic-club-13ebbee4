/**
 * Lightweight client-side throttle backed by localStorage.
 *
 * NOTE: This is a UX guard against accidental abuse (rapid clicks, refresh
 * loops). It is NOT a security boundary — a determined attacker can clear
 * storage. Supabase enforces its own server-side limits on auth endpoints.
 */

const KEY_PREFIX = "rl:";

export interface RateLimitState {
  allowed: boolean;
  retryInSeconds: number;
}

interface Entry {
  hits: number[]; // epoch ms
  blockedUntil?: number;
}

const read = (key: string): Entry => {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + key);
    return raw ? (JSON.parse(raw) as Entry) : { hits: [] };
  } catch {
    return { hits: [] };
  }
};

const write = (key: string, entry: Entry) => {
  try {
    localStorage.setItem(KEY_PREFIX + key, JSON.stringify(entry));
  } catch {
    /* storage full or disabled — ignore */
  }
};

/**
 * Check whether an action is currently allowed. Does NOT record a hit.
 */
export const checkRateLimit = (
  key: string,
  maxHits: number,
  windowMs: number
): RateLimitState => {
  const now = Date.now();
  const entry = read(key);

  if (entry.blockedUntil && entry.blockedUntil > now) {
    return {
      allowed: false,
      retryInSeconds: Math.ceil((entry.blockedUntil - now) / 1000),
    };
  }

  const recent = entry.hits.filter((t) => now - t < windowMs);
  if (recent.length >= maxHits) {
    const oldest = Math.min(...recent);
    return {
      allowed: false,
      retryInSeconds: Math.ceil((oldest + windowMs - now) / 1000),
    };
  }
  return { allowed: true, retryInSeconds: 0 };
};

/**
 * Record a hit. Triggers a `blockDurationMs` cooldown when `maxHits` is reached
 * within `windowMs`.
 */
export const recordHit = (
  key: string,
  maxHits: number,
  windowMs: number,
  blockDurationMs: number
): RateLimitState => {
  const now = Date.now();
  const entry = read(key);
  const recent = entry.hits.filter((t) => now - t < windowMs);
  recent.push(now);

  if (recent.length >= maxHits) {
    const blockedUntil = now + blockDurationMs;
    write(key, { hits: [], blockedUntil });
    return {
      allowed: true,
      retryInSeconds: Math.ceil(blockDurationMs / 1000),
    };
  }

  write(key, { hits: recent, blockedUntil: entry.blockedUntil });
  return { allowed: true, retryInSeconds: 0 };
};

export const clearRateLimit = (key: string) => {
  try {
    localStorage.removeItem(KEY_PREFIX + key);
  } catch {
    /* ignore */
  }
};
