import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from '../auth/public.decorator.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import { RedisService } from '../modules/redis/redis.service.js';
import { ConfigService } from '@nestjs/config';
import type {
  HealthResponse,
  ReadyResponse,
  VersionResponse,
} from './health.interfaces.js';

/**
 * Exposes diagnostic endpoints used by load balancers, orchestrators,
 * and uptime monitors.
 */
@Controller('health')
export class HealthController {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Liveness probe.
   * Returns 200 immediately; indicates the process is running.
   */
  @Public()
  @Get()
  getHealth(): HealthResponse {
    return {
      status: 'ok',
      version: '2.0.0',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Alias liveness probe.
   */
  @Public()
  @Get('live')
  getLive(): HealthResponse {
    return this.getHealth();
  }

  /**
   * Readiness probe.
   * Verifies Supabase, Redis (if configured), and Python AI microservice.
   */
  @Public()
  @Get('ready')
  async getReady(): Promise<ReadyResponse> {
    const checks: Partial<ReadyResponse> = {
      status: 'ready',
      database: 'connected',
    };

    let isHealthy = true;

    // 1. Supabase Check
    try {
      const client = this.supabaseService.getClient();
      const { error } = await client.from('profiles').select('id').limit(1);
      if (error) throw error;
    } catch (e) {
      checks.database = 'disconnected';
      isHealthy = false;
    }

    // 2. Redis Check (if enabled)
    if (this.redisService.getIsEnabled()) {
      try {
        await this.redisService.ping();
        checks.redis = 'connected';
      } catch (e) {
        checks.redis = 'disconnected';
        isHealthy = false;
      }
    } else {
      checks.redis = 'not_configured';
    }

    // 3. Python AI Check
    const pythonUrl = this.configService.get<string>('PYTHON_AI_URL') || 'http://localhost:8000';
    try {
      const res = await fetch(`${pythonUrl}/health`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        checks.pythonAi = 'connected';
      } else {
        checks.pythonAi = `error_status_${res.status}`;
        isHealthy = false;
      }
    } catch (e: any) {
      checks.pythonAi = `unreachable: ${e.message}`;
      isHealthy = false;
    }

    // 4. Provider Readiness checks
    const illustrationProvider = this.configService.get<string>('ILLUSTRATION_PROVIDER') || 'google';
    const audioProvider = this.configService.get<string>('AUDIO_PROVIDER') || 'edge';
    const imageProvider = this.configService.get<string>('IMAGE_PROVIDER') || 'mock';
    const googleApiKey = this.configService.get<string>('GOOGLE_API_KEY');

    checks.providers = {
      illustration: illustrationProvider,
      audio: audioProvider,
      image: imageProvider,
      googleApi: googleApiKey ? 'configured' : 'missing',
    };

    if (illustrationProvider === 'google' && !googleApiKey) {
      checks.providers.googleApi = 'missing_but_required';
    }

    if (!isHealthy) {
      checks.status = 'unhealthy';
      throw new ServiceUnavailableException(checks);
    }

    return checks as ReadyResponse;
  }

  /**
   * Version probe.
   */
  @Public()
  @Get('version')
  getVersion(): VersionResponse {
    return { version: '2.0.0', stage: 'production_hardening' };
  }
}
