import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

/** Canonical error response shape returned by every failed API call. */
interface ErrorResponse {
  success: false;
  statusCode: number;
  error: string;
  code: string;
  message: string | string[];
  trace_id: string;
  requestId: string;
}

function getHttpErrorPhrase(status: number): string {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return 'Bad Request';
    case HttpStatus.UNAUTHORIZED:
      return 'Unauthorized';
    case HttpStatus.FORBIDDEN:
      return 'Forbidden';
    case HttpStatus.NOT_FOUND:
      return 'Not Found';
    case HttpStatus.CONFLICT:
      return 'Conflict';
    case HttpStatus.UNPROCESSABLE_ENTITY:
      return 'Unprocessable Entity';
    case HttpStatus.TOO_MANY_REQUESTS:
      return 'Too Many Requests';
    case HttpStatus.SERVICE_UNAVAILABLE:
      return 'Service Unavailable';
    case HttpStatus.INTERNAL_SERVER_ERROR:
    default:
      return 'Internal Server Error';
  }
}

function resolveErrorCode(
  status: number,
  rawError?: string,
  msgStr?: string,
  customCode?: string,
): string {
  if (customCode) {
    return customCode;
  }

  if (
    rawError &&
    ![
      'HTTP_ERROR',
      'Bad Request',
      'Unauthorized',
      'Forbidden',
      'Not Found',
      'Internal Server Error',
      'Conflict',
      'Service Unavailable',
    ].includes(rawError)
  ) {
    return rawError;
  }

  if (msgStr) {
    const lower = msgStr.toLowerCase();
    if (lower.includes('illustration') && lower.includes('credit'))
      return 'INSUFFICIENT_ILLUSTRATION_CREDITS';
    if (lower.includes('credit')) return 'INSUFFICIENT_CREDITS';
    if (lower.includes('subscription') || lower.includes('limit reached'))
      return 'SUBSCRIPTION_LIMIT_REACHED';
    if (lower.includes('feature')) return 'FEATURE_NOT_AVAILABLE';
  }

  switch (status) {
    case HttpStatus.UNAUTHORIZED:
      return 'UNAUTHENTICATED';
    case HttpStatus.FORBIDDEN:
      return 'FORBIDDEN';
    case HttpStatus.NOT_FOUND:
      return 'RESOURCE_NOT_FOUND';
    case HttpStatus.CONFLICT:
      return 'CONFLICT';
    case HttpStatus.BAD_REQUEST:
    case HttpStatus.UNPROCESSABLE_ENTITY:
      return 'VALIDATION_ERROR';
    case HttpStatus.TOO_MANY_REQUESTS:
      return 'TOO_MANY_REQUESTS';
    case HttpStatus.SERVICE_UNAVAILABLE:
      return 'AI_PROVIDER_TEMPORARILY_UNAVAILABLE';
    case HttpStatus.INTERNAL_SERVER_ERROR:
    default:
      return 'INTERNAL_ERROR';
  }
}

/**
 * Global exception filter.
 *
 * Catches every thrown exception (HTTP and unexpected) and serializes it
 * into the Najmah standard error envelope so clients always receive a
 * consistent response shape.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const traceId = crypto.randomUUID();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: string | string[] = 'Internal server error';
    let rawError = getHttpErrorPhrase(status);
    let customCode: string | undefined;

    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const obj = res as Record<string, unknown>;
        message = (obj.message as string | string[]) || exception.message;
        if (typeof obj.error === 'string') {
          rawError = obj.error;
        }
        if (typeof obj.code === 'string') {
          customCode = obj.code;
        }
      }
    } else if (exception instanceof Error) {
      // Log unexpected errors — never surface internal details to the client
      this.logger.error(
        `Unexpected error [${traceId}]: ${exception.message}`,
        exception.stack,
      );
    }

    const msgString = Array.isArray(message) ? message.join(', ') : message;
    const code = resolveErrorCode(status, rawError, msgString, customCode);

    const body: ErrorResponse = {
      success: false,
      statusCode: status,
      error: rawError,
      code,
      message,
      trace_id: traceId,
      requestId: traceId,
    };

    response.status(status).json(body);
  }
}

