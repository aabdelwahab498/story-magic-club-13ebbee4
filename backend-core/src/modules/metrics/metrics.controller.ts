import {
  Controller,
  Get,
  Header,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { MetricsService } from './metrics.service.js';
import { Public } from '../../auth/public.decorator.js';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Public()
  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  getMetrics(@Req() req: any): string {
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction) {
      const secretHeader = req.headers['x-metrics-secret'];
      const metricsSecret = process.env.METRICS_SECRET;

      if (!metricsSecret || secretHeader !== metricsSecret) {
        throw new UnauthorizedException(
          'Access to production metrics endpoint is restricted.',
        );
      }
    }

    return this.metricsService.getPrometheusFormat();
  }
}
