export class AIProviderException extends Error {
  constructor(
    message: string,
    public readonly originalError?: any,
  ) {
    super(`AI Provider Error: ${message}`);
    this.name = 'AIProviderException';
  }
}

/**
 * Raised when the upstream AI provider stayed unavailable (429/503/5xx/timeout)
 * through the whole bounded retry policy. This is a *temporary* condition:
 * the HTTP layer maps it to 503 + AI_PROVIDER_TEMPORARILY_UNAVAILABLE so the
 * client can retry, instead of an opaque 500.
 */
export class AIProviderUnavailableException extends AIProviderException {
  static readonly CODE = 'AI_PROVIDER_TEMPORARILY_UNAVAILABLE';
  static readonly USER_MESSAGE =
    'The story service is temporarily busy. Please try again shortly.';

  readonly code = AIProviderUnavailableException.CODE;
  readonly retryable = true;

  constructor(
    message: string,
    public readonly meta: {
      provider: string;
      operation: string;
      attempts: number;
      httpStatus?: number;
      errorCategory: string;
      retryAfterMs?: number;
    },
    originalError?: any,
  ) {
    super(message, originalError);
    this.name = 'AIProviderUnavailableException';
  }
}

export class AIParseException extends Error {
  constructor(
    message: string,
    public readonly rawContent: string,
  ) {
    super(`AI Parse Error: ${message}`);
    this.name = 'AIParseException';
  }
}

export class AIValidationException extends Error {
  constructor(
    message: string,
    public readonly parsedContent: any,
  ) {
    super(`AI Validation Error: ${message}`);
    this.name = 'AIValidationException';
  }
}
