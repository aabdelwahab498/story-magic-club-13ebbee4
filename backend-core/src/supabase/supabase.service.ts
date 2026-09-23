import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

import { RequestContext } from '../common/middleware/request-context.js';

/**
 * Core Supabase integration service.
 *
 * Provides clients:
 * - `getClient()` — anon-key client for unauthenticated/general operations.
 * - `getUserClient(jwt?)` — client configured with caller JWT for user-scoped RLS operations.
 * - `getAdminClient()` — service-role client for privileged server-side operations (optional).
 */
@Injectable()
export class SupabaseService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseService.name);
  private client!: SupabaseClient;
  private adminClient?: SupabaseClient;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const url = this.configService.getOrThrow<string>('SUPABASE_URL');
    const anonKey = this.configService.getOrThrow<string>('SUPABASE_ANON_KEY');
    const serviceRoleKey = this.configService.get<string>(
      'SUPABASE_SERVICE_ROLE_KEY',
    );

    this.client = createClient(url, anonKey, {
      auth: { persistSession: false },
    });

    if (serviceRoleKey) {
      this.adminClient = createClient(url, serviceRoleKey, {
        auth: { persistSession: false },
      });
      this.logger.log('Supabase service-role client initialized');
    }

    this.logger.log('Supabase anon client initialized');
  }

  /** Returns the anon-key Supabase client. */
  getClient(): SupabaseClient {
    return this.client;
  }

  /** Checks whether a service-role client is available. */
  hasAdminClient(): boolean {
    return Boolean(this.adminClient);
  }

  /**
   * Returns the service-role Supabase admin client.
   * Throws an explicit configuration error if SUPABASE_SERVICE_ROLE_KEY is absent.
   */
  getAdminClient(): SupabaseClient {
    if (!this.adminClient) {
      throw new Error(
        'SUPABASE_SERVICE_ROLE_KEY is not configured in this environment.',
      );
    }
    return this.adminClient;
  }

  /**
   * Returns a Supabase client scoped to a user JWT (for RLS enforcement).
   * Uses caller JWT from parameter or RequestContext.authToken.
   */
  getUserClient(userJwt?: string): SupabaseClient {
    const token = userJwt || RequestContext.authToken;
    if (!token) {
      return this.client;
    }

    const url = this.configService.getOrThrow<string>('SUPABASE_URL');
    const anonKey = this.configService.getOrThrow<string>('SUPABASE_ANON_KEY');

    return createClient(url, anonKey, {
      auth: { persistSession: false },
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });
  }

  /**
   * Verifies a Supabase JWT and returns the associated user.
   * @param token - Raw bearer token (without the "Bearer " prefix).
   * @returns The authenticated User, or null if the token is invalid.
   */
  async verifyToken(token: string): Promise<User | null> {
    // 1. Perform local claims validation to fail-fast
    const parts = token.split('.');
    if (parts.length === 3) {
      try {
        const payload = JSON.parse(
          Buffer.from(parts[1], 'base64').toString('utf8'),
        );

        // Expiration check
        if (payload.exp && Date.now() >= payload.exp * 1000) {
          this.logger.warn('Token verification failed: token is expired');
          return null;
        }

        // Audience check
        const expectedAud =
          this.configService.get<string>('JWT_AUDIENCE') || 'authenticated';
        if (payload.aud !== undefined && payload.aud !== null) {
          if (typeof payload.aud === 'string') {
            if (payload.aud !== expectedAud) {
              this.logger.warn(
                `Token verification failed: invalid audience. Expected ${expectedAud}, got ${payload.aud}`,
              );
              return null;
            }
          } else if (Array.isArray(payload.aud)) {
            if (!payload.aud.includes(expectedAud)) {
              this.logger.warn(
                `Token verification failed: invalid audience. Expected ${expectedAud}, got ${JSON.stringify(payload.aud)}`,
              );
              return null;
            }
          } else {
            this.logger.warn(
              `Token verification failed: invalid audience type. Expected string or array, got ${typeof payload.aud}`,
            );
            return null;
          }
        }

        // Issuer check
        const expectedIss = this.configService.get<string>('JWT_ISSUER');
        if (expectedIss && payload.iss && payload.iss !== expectedIss) {
          this.logger.warn(`Token verification failed: invalid issuer. Expected ${expectedIss}, got ${payload.iss}`);
          return null;
        }
      } catch (err: any) {
        this.logger.warn(`Malformed JWT token: ${err.message}`);
        return null;
      }
    } else {
      this.logger.warn('Token verification failed: invalid token structure');
      return null;
    }

    // 2. Delegate to Supabase to verify the cryptographic signature
    const {
      data: { user },
      error,
    } = await this.client.auth.getUser(token);

    if (error || !user) {
      return null;
    }

    return user;
  }
}
