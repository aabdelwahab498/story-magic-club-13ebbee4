import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { AIProviderUnavailableException } from '../../modules/ai/exceptions/ai.exceptions.js';

/** Canonical error response shape returned by every failed API call. */
interface ErrorResponse {
  success: false;
  code: string;
  message: string | string[];
  trace_id: string;
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
    let code = 'INTERNAL_SERVER_ERROR';

    // Temporary AI provider outage → controlled, retryable 503 (never an
    // opaque 500). No provider payloads, prompts or credentials are exposed.
    if (exception instanceof AIProviderUnavailableException) {
      this.logger.warn(
        JSON.stringify({
          event: 'ai_provider_unavailable_response',
          trace_id: traceId,
          code: AIProviderUnavailableException.CODE,
          httpStatus: 503,
          ...exception.meta,
        }),
      );
      response.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        success: false,
        code: AIProviderUnavailableException.CODE,
        message: AIProviderUnavailableException.USER_MESSAGE,
        retryable: true,
        trace_id: traceId,
      } satisfies ErrorResponse & { retryable: boolean });
      return;
    }

    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
        code = 'HTTP_ERROR';
      } else if (typeof res === 'object' && res !== null) {
        const obj = res as Record<string, unknown>;
        message = (obj.message as string | string[]) || exception.message;
        code = (obj.error as string) || 'HTTP_ERROR';
      }
    } else if (exception instanceof Error) {
      // Log unexpected errors — never surface internal details to the client
      this.logger.error(
        `Unexpected error [${traceId}]: ${exception.message}`,
        exception.stack,
      );
    }

    const body: ErrorResponse = {
      success: false,
      code,
      message,
      trace_id: traceId,
    };

    response.status(status).json(body);
  }
}
