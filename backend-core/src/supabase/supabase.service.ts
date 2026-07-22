import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

/**
 * Core Supabase integration service.
 *
 * Provides two clients:
 * - `getClient()` — anon-key client for end-user authenticated operations.
 * - `getAdminClient()` — service-role client for privileged server-side operations.
 *   NEVER expose the admin client to any public-facing route.
 */
@Injectable()
export class SupabaseService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseService.name);
  private client!: SupabaseClient;
  private adminClient!: SupabaseClient;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const url = this.configService.getOrThrow<string>('SUPABASE_URL');
    const anonKey = this.configService.getOrThrow<string>('SUPABASE_ANON_KEY');
    const serviceRoleKey = this.configService.getOrThrow<string>(
      'SUPABASE_SERVICE_ROLE_KEY',
    );

    this.client = createClient(url, anonKey, {
      auth: { persistSession: false },
    });

    this.adminClient = createClient(url, serviceRoleKey, {
      auth: { persistSession: false },
    });

    this.logger.log('Supabase clients initialized');
  }

  /** Returns the anon-key Supabase client. */
  getClient(): SupabaseClient {
    return this.client;
  }

  /**
   * Returns the service-role Supabase admin client.
   * @warning Must only be used in server-side, non-public contexts.
   */
  getAdminClient(): SupabaseClient {
    return this.adminClient;
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
        const expectedAud = this.configService.get<string>('JWT_AUDIENCE') || 'authenticated';
        if (payload.aud && payload.aud !== expectedAud) {
          this.logger.warn(`Token verification failed: invalid audience. Expected ${expectedAud}, got ${payload.aud}`);
          return null;
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
