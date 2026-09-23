import axios from 'axios';

export class ApiError extends Error {
  constructor(
    public status: number,
    public message: string,
    public data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export type NormalizedErrorCategory =
  | 'VALIDATION_ERROR'
  | 'AUTH_REQUIRED'
  | 'FORBIDDEN'
  | 'INSUFFICIENT_CREDITS'
  | 'CONFLICT'
  | 'TEMPORARILY_RATE_LIMITED'
  | 'AI_TEMPORARILY_UNAVAILABLE'
  | 'NETWORK_TEMPORARY_FAILURE'
  | 'INTERNAL_ERROR';

export interface NormalizedError {
  status: number;
  code: string;
  category: NormalizedErrorCategory;
  retryable: boolean;
  message: string;
  userMessage: string;
  correlationId?: string;
  rawDetails?: unknown;
}

export function sanitizeClientSecrets(text: string): string {
  if (!text) return '';
  return text
    .replace(/(key=)[^&"'\s]+/gi, '$1[REDACTED]')
    .replace(/(api_key=)[^&"'\s]+/gi, '$1[REDACTED]')
    .replace(/(apikey=)[^&"'\s]+/gi, '$1[REDACTED]')
    .replace(/(secret=)[^&"'\s]+/gi, '$1[REDACTED]')
    .replace(/(token=)[^&"'\s]+/gi, '$1[REDACTED]')
    .replace(/(Authorization:\s*Bearer\s+)[^"'\s]+/gi, '$1[REDACTED]')
    .replace(/https?:\/\/[^\s]+/gi, '[URL]');
}

export function normalizeApiError(error: unknown, language: string = 'en'): NormalizedError {
  const isAr = language === 'ar';
  let status = 500;
  let rawMessage = '';
  let code = 'INTERNAL_ERROR';
  let data: any = null;

  if (error instanceof ApiError) {
    status = error.status;
    rawMessage = error.message;
    data = error.data;
  } else if (axios.isAxiosError(error) || (error && typeof error === 'object' && ('response' in error || 'status' in error))) {
    const errObj = error as any;
    status = errObj.response?.status || errObj.status || (errObj.code === 'ECONNABORTED' ? 408 : 500);
    data = errObj.response?.data || errObj.data;
    rawMessage = data?.message || errObj.message || (typeof errObj === 'string' ? errObj : '');
  } else if (error instanceof Error) {
    rawMessage = error.message;
    status = (error as any).status || 500;
  } else {
    rawMessage = String(error);
  }

  code = data?.code || data?.error || (error as any)?.code || (status === 401 ? 'unauthorized' : status === 403 ? 'forbidden' : 'error');
  const lowerMsg = `${rawMessage} ${JSON.stringify(data || {})}`.toLowerCase();


  let category: NormalizedErrorCategory = 'INTERNAL_ERROR';
  let retryable = true;
  let userMessage = isAr
    ? 'تعديل القصص جاري، يُرجى المحاولة بعد قليل.'
    : 'Preparing your magical story… please try again in a moment.';

  // 1. Network / Timeout
  if (
    status === 408 ||
    lowerMsg.includes('network') ||
    lowerMsg.includes('timeout') ||
    lowerMsg.includes('econnaborted') ||
    lowerMsg.includes('fetch failed')
  ) {
    category = 'NETWORK_TEMPORARY_FAILURE';
    retryable = true;
    userMessage = isAr
      ? 'تعذر الاتصال بنجمة الآن. إعدادات قصتك محفوظة بآمان، يُرجى التحقق من الاتصال والمحاولة مجدداً.'
      : "We couldn't reach Najmah right now. Your story settings are safe. Please check your connection and try again.";
  }
  // 2. Auth / 401
  else if (status === 401 || code === 'unauthorized' || lowerMsg.includes('session') || lowerMsg.includes('jwt')) {
    category = 'AUTH_REQUIRED';
    retryable = false;
    userMessage = isAr
      ? 'انتهت جلستك. يُرجى تسجيل الدخول مرة أخرى.'
      : 'Your session has expired. Please sign in again.';
  }
  // 3. Credits / Quota / 402
  else if (
    status === 402 ||
    code === 'insufficient_credits' ||
    code === 'ai_credits_exhausted' ||
    lowerMsg.includes('credit') ||
    lowerMsg.includes('quota')
  ) {
    category = 'INSUFFICIENT_CREDITS';
    retryable = false;
    const isIllustrationCredit = lowerMsg.includes('illustration') || code === 'illustration_credits_exhausted';
    if (isIllustrationCredit) {
      userMessage = isAr
        ? 'ليس لديك رصيد رسومات كافٍ لهذا الإجراء.'
        : "You don't have enough illustration credits for this action.";
    } else {
      userMessage = isAr
        ? 'لقد وصلت إلى الحد الأقصى للقصص في خطتك الحالية.'
        : "You've reached your story limit for the current plan.";
    }
  }
  // 4. Forbidden / 403
  else if (status === 403 || code === 'forbidden') {
    category = 'FORBIDDEN';
    retryable = false;
    userMessage = isAr
      ? 'غير مصرح لك بإجراء هذا الإجراء.'
      : 'You do not have permission for this action.';
  }
  // 5. Validation / 400
  else if (status === 400 || status === 422 || code === 'validation_error') {
    category = 'VALIDATION_ERROR';
    retryable = false;
    userMessage = isAr
      ? 'يُرجى التحقق من إعدادات القصة والمحاولة مرة أخرى.'
      : 'Please check your story settings and try again.';
  }
  // 6. Conflict / 409
  else if (status === 409) {
    category = 'CONFLICT';
    retryable = false;
    userMessage = isAr
      ? 'الطلب موجود بالفعل أو غير متزامن.'
      : 'The request is out of sync or already exists.';
  }
  // 7. Rate limit / 429
  else if (status === 429) {
    category = 'TEMPORARILY_RATE_LIMITED';
    retryable = true;
    userMessage = isAr
      ? 'نجمة مشغولة حالياً بكتابة القصص. إعدادات قصتك محفوظة بآمان، يُرجى المحاولة بعد قليل.'
      : 'Najmah is a little busy creating stories right now. Your story settings are safe. Please try again shortly.';
  }
  // 8. 503 / 502 / 504 / Provider Unavailable
  else if (
    status === 503 ||
    status === 502 ||
    status === 504 ||
    code === 'ai_provider_temporarily_unavailable' ||
    lowerMsg.includes('provider') ||
    lowerMsg.includes('service unavailable')
  ) {
    category = 'AI_TEMPORARILY_UNAVAILABLE';
    retryable = true;
    userMessage = isAr
      ? 'نجمة مشغولة حالياً بكتابة القصص. إعدادات قصتك محفوظة بآمان، يُرجى المحاولة بعد قليل.'
      : 'Najmah is a little busy creating stories right now. Your story settings are safe. Please try again shortly.';
  }
  // 9. Default Internal Error
  else {
    category = 'INTERNAL_ERROR';
    retryable = true;
    userMessage = isAr
      ? 'تجهيز قصتك السحرية... يُرجى المحاولة مرة أخرى بعد لحظات.'
      : 'Preparing your magical story… please try again in a moment.';
  }

  return {
    status,
    code: String(code),
    category,
    retryable,
    message: sanitizeClientSecrets(rawMessage),
    userMessage,
    rawDetails: data,
  };
}

/**
 * Maps raw Axios errors into a standardized ApiError shape.
 */
export const errorMapper = (error: any): never => {
  if (axios.isAxiosError(error) || error?.name === 'AxiosError' || error?.response || error?.config) {
    const status = error.response?.status || 500;
    let message = '';
    
    if (error.code === 'ECONNABORTED') {
      message = 'Request timed out. Please try again.';
    } else if (error.response?.data?.message) {
      message = Array.isArray(error.response.data.message)
        ? error.response.data.message.join(', ')
        : error.response.data.message;
    } else if (!error.response) {
      message = 'Network error. Please check your connection.';
    }

    if (!message) {
      switch (status) {
        case 401:
          message = 'Unauthorized. Please log in again.';
          break;
        case 403:
          message = 'Forbidden. You do not have permission to perform this action.';
          break;
        case 404:
          message = 'The requested resource was not found.';
          break;
        case 409:
          message = 'Conflict. The resource already exists or is out of sync.';
          break;
        case 422:
          message = 'Unprocessable Entity. Validation failed.';
          break;
        case 429:
          message = 'Too many requests. Please slow down and try again later.';
          break;
        case 500:
          message = 'Internal Server Error. Please try again later.';
          break;
        default:
          message = error.message || 'An error occurred';
      }
    }

    throw new ApiError(status, message, error.response?.data);
  }
  
  // Standard fallback
  throw new ApiError(500, error instanceof Error ? error.message : 'An unknown error occurred');
};

