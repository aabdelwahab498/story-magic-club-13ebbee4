import {
  classifyProviderError,
  ErrorCategory,
  sanitizeSecrets,
} from './provider-error.classifier.js';

describe('Provider Error Classifier & Secret Sanitizer', () => {
  describe('classifyProviderError', () => {
    it('classifies 429, 503, 504 as RETRYABLE_TRANSIENT', () => {
      expect(classifyProviderError({ status: 429 }).category).toBe(
        ErrorCategory.RETRYABLE_TRANSIENT,
      );
      expect(classifyProviderError({ status: 503 }).category).toBe(
        ErrorCategory.RETRYABLE_TRANSIENT,
      );
      expect(classifyProviderError({ status: 504 }).category).toBe(
        ErrorCategory.RETRYABLE_TRANSIENT,
      );
    });

    it('classifies 400, 401, 403 as NON_RETRYABLE_PERMANENT', () => {
      expect(classifyProviderError({ status: 400 }).category).toBe(
        ErrorCategory.NON_RETRYABLE_PERMANENT,
      );
      expect(classifyProviderError({ status: 401 }).category).toBe(
        ErrorCategory.NON_RETRYABLE_PERMANENT,
      );
      expect(classifyProviderError({ status: 403 }).category).toBe(
        ErrorCategory.NON_RETRYABLE_PERMANENT,
      );
    });

    it('classifies timeout and connection error messages as RETRYABLE_TRANSIENT', () => {
      expect(
        classifyProviderError(new Error('ETIMEDOUT: connection timeout'))
          .category,
      ).toBe(ErrorCategory.RETRYABLE_TRANSIENT);
      expect(
        classifyProviderError(new Error('Rate limit exceeded')).category,
      ).toBe(ErrorCategory.RETRYABLE_TRANSIENT);
    });
  });

  describe('sanitizeSecrets', () => {
    it('redacts key= in URL parameters', () => {
      const url =
        'https://generativelanguage.googleapis.com/v1/models?key=AIzaSySecretKey123&other=val';
      const sanitized = sanitizeSecrets(url);
      expect(sanitized).not.toContain('AIzaSySecretKey123');
      expect(sanitized).toBe(
        'https://generativelanguage.googleapis.com/v1/models?key=[REDACTED]&other=val',
      );
    });

    it('redacts Authorization Bearer tokens', () => {
      const text = 'Headers: Authorization: Bearer secret-token-xyz';
      const sanitized = sanitizeSecrets(text);
      expect(sanitized).toBe('Headers: Authorization: Bearer [REDACTED]');
    });
  });
});
