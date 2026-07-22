import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { Env } from '../../config/env.config';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private redisClient: Redis | null = null;
  private isEnabled = false;

  constructor(private readonly configService: ConfigService<Env, true>) {}

  onModuleInit(): void {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    if (redisUrl) {
      this.logger.log(`Initializing Redis client connecting to ${redisUrl}`);
      try {
        this.redisClient = new Redis(redisUrl, {
          maxRetriesPerRequest: 3,
          lazyConnect: true,
        });
        this.isEnabled = true;
      } catch (err: any) {
        this.logger.error('Failed to instantiate Redis client', err.message);
      }
    } else {
      this.logger.log('Redis is not configured (REDIS_URL is empty)');
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redisClient) {
      this.logger.log('Closing Redis connection...');
      try {
        await this.redisClient.quit();
        this.logger.log('Redis connection closed successfully.');
      } catch (err: any) {
        this.logger.warn(`Error closing Redis client: ${err.message}`);
        this.redisClient.disconnect();
      }
    }
  }

  getIsEnabled(): boolean {
    return this.isEnabled;
  }

  getClient(): Redis | null {
    return this.redisClient;
  }

  async ping(): Promise<string> {
    if (!this.isEnabled || !this.redisClient) {
      throw new Error('Redis is not enabled');
    }
    const pingPromise = this.redisClient.ping();
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Redis ping timeout (3s)')), 3000),
    );
    return Promise.race([pingPromise, timeoutPromise]);
  }
}
