import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { MetricsController } from './metrics.controller.js';
import { MetricsService } from './metrics.service.js';

describe('MetricsController', () => {
  let controller: MetricsController;
  let metricsService: MetricsService;

  const mockMetricsService = {
    getPrometheusFormat: jest.fn().mockReturnValue('# HELP http_requests_total Total number of HTTP requests\n'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    delete process.env.NODE_ENV;
    delete process.env.METRICS_SECRET;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MetricsController],
      providers: [
        {
          provide: MetricsService,
          useValue: mockMetricsService,
        },
      ],
    }).compile();

    controller = module.get<MetricsController>(MetricsController);
    metricsService = module.get<MetricsService>(MetricsService);
  });

  it('should return metrics in non-production environment without header', () => {
    process.env.NODE_ENV = 'development';
    const req = { headers: {} };
    const result = controller.getMetrics(req);

    expect(result).toContain('http_requests_total');
    expect(mockMetricsService.getPrometheusFormat).toHaveBeenCalled();
  });

  it('should throw UnauthorizedException in production environment when secret header is missing', () => {
    process.env.NODE_ENV = 'production';
    process.env.METRICS_SECRET = 'secret123';
    const req = { headers: {} };

    expect(() => controller.getMetrics(req)).toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException in production environment when secret header is invalid', () => {
    process.env.NODE_ENV = 'production';
    process.env.METRICS_SECRET = 'secret123';
    const req = { headers: { 'x-metrics-secret': 'wrong' } };

    expect(() => controller.getMetrics(req)).toThrow(UnauthorizedException);
  });

  it('should return metrics in production environment when secret header matches', () => {
    process.env.NODE_ENV = 'production';
    process.env.METRICS_SECRET = 'secret123';
    const req = { headers: { 'x-metrics-secret': 'secret123' } };

    const result = controller.getMetrics(req);
    expect(result).toContain('http_requests_total');
  });
});
