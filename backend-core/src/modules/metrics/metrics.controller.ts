import { Controller, Get, Header } from '@nestjs/common';
import { MetricsService } from './metrics.service.js';
import { Public } from '../../auth/public.decorator.js';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Public()
  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  getMetrics(): string {
    return this.metricsService.getPrometheusFormat();
  }
}
