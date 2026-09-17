/**
 * Provider error classification for the Gemini LLM provider.
 *
 * Distinguishes RETRYABLE_TRANSIENT provider conditions (overload, rate
 * limiting, timeouts, socket resets) from PERMANENT failures (bad request,
 * bad credentials, unsupported model) so the retry policy only re-sends
 * requests that can plausibly succeed.
 */

export type ProviderErrorCategory = 'RETRYABLE_TRANSIENT' | 'PERMANENT';

export interface ClassifiedProviderError {
  category: ProviderErrorCategory;
  retryable: boolean;
  /** Upstream HTTP status when the provider exposed one. */
  httpStatus?: number;
  /** Retry delay advertised by the provider, in milliseconds (uncapped). */
  retryAfterMs?: number;
  /** Short, safe label for structured logs — never carries prompt content. */
  reason: string;
}

const TRANSIENT_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504, 529]);
const PERMANENT_STATUSES = new Set([400, 401, 403, 404, 405, 422]);

const TRANSIENT_CODES = [
  'ETIMEDOUT',
  'ECONNRESET',
  'ECONNREFUSED',
  'ECONNABORTED',
  'EAI_AGAIN',
  'EPIPE',
  'ENETUNREACH',
  'ENOTFOUND',
  'UND_ERR_SOCKET',
  'UND_ERR_CONNECT_TIMEOUT',
];

const TRANSIENT_MESSAGE_PATTERNS = [
  /timeout/i,
  /timed out/i,
  /temporarily/i,
  /high demand/i,
  /overload/i,
  /unavailable/i,
  /try again later/i,
  /rate limit/i,
  /too many requests/i,
  /socket hang up/i,
  /network/i,
  /fetch failed/i,
  /deadline exceeded/i,
];

const PERMANENT_MESSAGE_PATTERNS = [
  /api key not valid/i,
  /invalid api key/i,
  /permission denied/i,
  /unauthenticated/i,
  /unauthorized/i,
  /not found for api version/i,
  /is not supported/i,
  /unsupported model/i,
  /invalid argument/i,
  /malformed/i,
  /safety/i,
];

function readNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function extractStatus(error: unknown): number | undefined {
  const e = error as Record<string, any> | null;
  if (!e) return undefined;
  return (
    readNumber(e.status) ??
    readNumber(e.statusCode) ??
    readNumber(e.code) ??
    readNumber(e.response?.status) ??
    readNumber(e.cause?.status) ??
    extractStatusFromMessage(String(e.message ?? ''))
  );
}

function extractStatusFromMessage(message: string): number | undefined {
  const match = /\[?(\d{3})\s*(?:[\]\-:]|Service|Too Many|Internal)/.exec(
    message,
  );
  const status = match ? Number(match[1]) : undefined;
  return status && status >= 400 && status <= 599 ? status : undefined;
}

/** Reads a provider-advertised retry delay (`Retry-After` seconds, or RetryInfo). */
function extractRetryAfterMs(error: unknown): number | undefined {
  const e = error as Record<string, any> | null;
  if (!e) return undefined;

  const header =
    e.response?.headers?.['retry-after'] ??
    e.response?.headers?.get?.('retry-after') ??
    e.headers?.['retry-after'];
  const headerSeconds = readNumber(header);
  if (headerSeconds !== undefined && headerSeconds >= 0) {
    return headerSeconds * 1000;
  }

  // Google API RetryInfo details: { retryDelay: "12s" }
  const details: any[] = e.errorDetails ?? e.response?.data?.error?.details ?? [];
  if (Array.isArray(details)) {
    for (const detail of details) {
      const delay = detail?.retryDelay ?? detail?.retry_delay;
      if (typeof delay === 'string') {
        const seconds = Number(delay.replace(/s$/, ''));
        if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
      }
    }
  }
  return undefined;
}

export function classifyProviderError(error: unknown): ClassifiedProviderError {
  const message = String((error as Error | null)?.message ?? error ?? '');
  const httpStatus = extractStatus(error);
  const retryAfterMs = extractRetryAfterMs(error);
  const nodeCode = String((error as any)?.code ?? '');

  if (httpStatus !== undefined && PERMANENT_STATUSES.has(httpStatus)) {
    return {
      category: 'PERMANENT',
      retryable: false,
      httpStatus,
      reason: `permanent_http_${httpStatus}`,
    };
  }

  if (httpStatus !== undefined && TRANSIENT_STATUSES.has(httpStatus)) {
    return {
      category: 'RETRYABLE_TRANSIENT',
      retryable: true,
      httpStatus,
      retryAfterMs,
      reason: `transient_http_${httpStatus}`,
    };
  }

  if (PERMANENT_MESSAGE_PATTERNS.some((re) => re.test(message))) {
    return {
      category: 'PERMANENT',
      retryable: false,
      httpStatus,
      reason: 'permanent_provider_rejection',
    };
  }

  if (TRANSIENT_CODES.includes(nodeCode)) {
    return {
      category: 'RETRYABLE_TRANSIENT',
      retryable: true,
      httpStatus,
      retryAfterMs,
      reason: `transient_${nodeCode.toLowerCase()}`,
    };
  }

  if (TRANSIENT_MESSAGE_PATTERNS.some((re) => re.test(message))) {
    return {
      category: 'RETRYABLE_TRANSIENT',
      retryable: true,
      httpStatus,
      retryAfterMs,
      reason: 'transient_network_or_overload',
    };
  }

  // Unknown provider faults are treated as transient: they are rare and a
  // bounded retry is cheaper than failing a user's story request outright.
  return {
    category: 'RETRYABLE_TRANSIENT',
    retryable: true,
    httpStatus,
    retryAfterMs,
    reason: 'transient_unclassified',
  };
}
