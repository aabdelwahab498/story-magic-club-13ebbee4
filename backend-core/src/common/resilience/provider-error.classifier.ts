export enum ErrorCategory {
  RETRYABLE_TRANSIENT = 'RETRYABLE_TRANSIENT',
  NON_RETRYABLE_PERMANENT = 'NON_RETRYABLE_PERMANENT',
}

export interface ClassifiedProviderError {
  category: ErrorCategory;
  isRetryable: boolean;
  statusCode?: number;
  message: string;
  originalError: any;
}

export function classifyProviderError(error: any): ClassifiedProviderError {
  const message = error?.message || String(error);
  const status = error?.status || error?.statusCode || error?.response?.status;

  // Check HTTP status code if available
  if (typeof status === 'number') {
    if (
      status === 429 ||
      status === 408 ||
      status >= 500
    ) {
      return {
        category: ErrorCategory.RETRYABLE_TRANSIENT,
        isRetryable: true,
        statusCode: status,
        message,
        originalError: error,
      };
    }

    if (status >= 400 && status < 500) {
      return {
        category: ErrorCategory.NON_RETRYABLE_PERMANENT,
        isRetryable: false,
        statusCode: status,
        message,
        originalError: error,
      };
    }
  }

  // Check error message or code patterns for timeouts/transient issues
  const lowerMsg = message.toLowerCase();
  const code = (error?.code || '').toLowerCase();

  if (
    lowerMsg.includes('timeout') ||
    lowerMsg.includes('econnreset') ||
    lowerMsg.includes('etimedout') ||
    lowerMsg.includes('econnrefused') ||
    lowerMsg.includes('rate limit') ||
    lowerMsg.includes('quota exceeded') ||
    lowerMsg.includes('resource_exhausted') ||
    lowerMsg.includes('resource exhausted') ||
    lowerMsg.includes('network') ||
    lowerMsg.includes('temporarily unavailable') ||
    lowerMsg.includes('service unavailable') ||
    lowerMsg.includes('overloaded') ||
    lowerMsg.includes('fetch failed') ||
    code === 'etimedout' ||
    code === 'econnreset' ||
    code === 'econnrefused'
  ) {
    return {
      category: ErrorCategory.RETRYABLE_TRANSIENT,
      isRetryable: true,
      statusCode: status,
      message,
      originalError: error,
    };
  }

  // Circuit breaker open is transient
  if (lowerMsg.includes('circuit breaker is open')) {
    return {
      category: ErrorCategory.RETRYABLE_TRANSIENT,
      isRetryable: true,
      statusCode: 503,
      message,
      originalError: error,
    };
  }

  // Check for known permanent error indicators
  if (
    lowerMsg.includes('insufficient credits') ||
    lowerMsg.includes('unauthorized') ||
    lowerMsg.includes('forbidden') ||
    lowerMsg.includes('invalid input') ||
    lowerMsg.includes('validation error') ||
    lowerMsg.includes('not found')
  ) {
    return {
      category: ErrorCategory.NON_RETRYABLE_PERMANENT,
      isRetryable: false,
      statusCode: status || 400,
      message,
      originalError: error,
    };
  }

  // Default to permanent non-retryable for client/parse/bad request errors
  return {
    category: ErrorCategory.NON_RETRYABLE_PERMANENT,
    isRetryable: false,
    statusCode: status,
    message,
    originalError: error,
  };
}

export function sanitizeSecrets(text: string): string {
  if (!text) return text;
  return text
    .replace(/(key=)[^&"'\s]+/gi, '$1[REDACTED]')
    .replace(/(api_key=)[^&"'\s]+/gi, '$1[REDACTED]')
    .replace(/(apikey=)[^&"'\s]+/gi, '$1[REDACTED]')
    .replace(/(secret=)[^&"'\s]+/gi, '$1[REDACTED]')
    .replace(/(token=)[^&"'\s]+/gi, '$1[REDACTED]')
    .replace(/(Authorization:\s*Bearer\s+)[^"'\s]+/gi, '$1[REDACTED]');
}

