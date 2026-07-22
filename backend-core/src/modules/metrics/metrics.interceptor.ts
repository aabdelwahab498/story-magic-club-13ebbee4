import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, finalize } from 'rxjs/operators';
import { MetricsService } from './metrics.service.js';
import type { Request, Response } from 'express';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request>();
    const response = httpContext.getResponse<Response>();

    const path = request.path || '';
    if (path.includes('/health') || path.includes('/metrics')) {
      return next.handle();
    }

    const startTime = Date.now();
    this.metricsService.incrementActiveRequests();
    this.metricsService.incrementHttpRequests();

    if (path.includes('/stories') || path.includes('/story')) {
      this.metricsService.incrementStoryGeneration();
    }
    if (path.includes('/illustration') || path.includes('/illustrations')) {
      this.metricsService.incrementIllustrationGeneration();
    }
    if (path.includes('/audio') || path.includes('/tts')) {
      this.metricsService.incrementAudioGeneration();
    }
    if (path.includes('/pdf')) {
      this.metricsService.incrementPdfExport();
    }

    return next.handle().pipe(
      tap({
        error: () => {
          this.metricsService.incrementHttpErrors();
        },
      }),
      finalize(() => {
        const latencyMs = Date.now() - startTime;
        const latencySeconds = latencyMs / 1000;
        this.metricsService.observeHttpRequestDuration(latencySeconds);
        this.metricsService.decrementActiveRequests();

        if (response.statusCode >= 400) {
          this.metricsService.incrementHttpErrors();
        }
      }),
    );
  }
}
